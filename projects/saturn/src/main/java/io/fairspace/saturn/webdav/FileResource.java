package io.fairspace.saturn.webdav;

import io.fairspace.saturn.vocabulary.FS;
import io.milton.http.Auth;
import io.milton.http.FileItem;
import io.milton.http.Range;
import io.milton.http.Request;
import io.milton.http.exceptions.BadRequestException;
import io.milton.http.exceptions.ConflictException;
import io.milton.http.exceptions.NotAuthorizedException;
import io.milton.http.exceptions.NotFoundException;
import io.milton.resource.ReplaceableResource;
import lombok.SneakyThrows;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Date;
import java.util.Map;

import static io.fairspace.saturn.rdf.ModelUtils.*;
import static io.fairspace.saturn.webdav.WebDAVServlet.*;
import static io.milton.http.ResponseStatus.SC_FORBIDDEN;
import static java.lang.Integer.parseInt;

class FileResource extends BaseResource implements io.milton.resource.FileResource, ReplaceableResource {
    private int version;
    private String blobId;
    private long contentLength;
    private Date modifiedDate;
    private boolean singleVersion;

    @SneakyThrows
    FileResource(DavFactory factory, Resource subject, Access access) {
        super(factory, subject, access);

        loadVersion();
    }

    private void loadVersion() throws BadRequestException {
        var versions = getListProperty(subject, FS.versions);
        var ver = fileVersion();
        version = (ver != null) ? ver : versions.size();

        if (version < 1 || version > versions.size()) {
            var message = "Invalid file version";
            setErrorMessage(message);
            throw new BadRequestException(message);
        }

        var current = versions.get(subject.getProperty(FS.currentVersion).getInt() - version).asResource();

        blobId = current.getRequiredProperty(FS.blobId).getString();
        contentLength = current.getRequiredProperty(FS.fileSize).getLong();
        modifiedDate = parseDate(current, FS.dateModified);
        singleVersion = versions.size() == 1;
    }

    @Override
    public boolean authorise(Request request, Request.Method method, Auth auth) {
        return switch (method) {
            case GET, COPY -> access.canRead();
            default -> super.authorise(request, method, auth);
        };
    }

    @Override
    public void sendContent(OutputStream out, Range range, Map<String, String> params, String contentType) throws IOException, NotAuthorizedException, BadRequestException, NotFoundException {
        factory.store.read(blobId, out, range != null ? range.getStart() : 0, range != null ? range.getFinish() : null);
    }

    @Override
    public Long getMaxAgeSeconds(Auth auth) {
        return singleVersion ? Long.MAX_VALUE : null;
    }

    @Override
    public String getContentType(String accepts) {
        return getStringProperty(subject, FS.contentType);
    }

    @Override
    public Long getContentLength() {
        return contentLength;
    }

    @Override
    public void replaceContent(InputStream in, Long length) throws BadRequestException, ConflictException, NotAuthorizedException {
        replaceContent(getBlob());
    }

    void replaceContent(BlobInfo blobInfo) throws BadRequestException, ConflictException, NotAuthorizedException {
        if (subject.hasProperty(FS.dateDeleted)) {
            var message = "Target file with this name already exists and is marked as deleted. " +
                    "Deleted file cannot be overwritten.";
            setErrorMessage(message);
            throw new ConflictException(this, message);
        }

        var versions = getListProperty(subject, FS.versions).cons(newVersion(blobInfo));
        var current = subject.getRequiredProperty(FS.currentVersion).getInt() + 1;

        subject.removeAll(FS.versions)
                .removeAll(FS.currentVersion)
                .addProperty(FS.versions, versions)
                .addLiteral(FS.currentVersion, current);

        loadVersion();
    }

    @Override
    public Date getModifiedDate() {
        return modifiedDate;
    }


    @Property
    public int getVersion() {
        return version;
    }

    @Property
    public String getAccess() {
        return access.name();
    }

    @Override
    protected void performAction(String action, Map<String, String> parameters, Map<String, FileItem> files) throws BadRequestException, NotAuthorizedException, ConflictException {
        switch (action) {
            case "revert" -> revert(parameters.get("version"));
            default -> super.performAction(action, parameters, files);
        }
    }

    private void revert(String versionStr) throws BadRequestException, NotAuthorizedException, ConflictException {
        if (!access.canWrite()) {
            var message = "Not authorized to revert this resource to a previous version.";
            setErrorMessage(message);
            throw new NotAuthorizedException(message, this, SC_FORBIDDEN);
        }

        int version;
        try {
            version = parseInt(versionStr);
        } catch (Exception e) {
            var message = "No version provided";
            setErrorMessage(message);
            throw new BadRequestException(this, message);
        }
        var versions = getListProperty(subject, FS.versions);
        var ver = versions.get(subject.getProperty(FS.currentVersion).getInt() - version).asResource();
        var newVer = subject.getModel()
                .createResource();

        copyProperties(ver, newVer, RDF.type, FS.blobId, FS.fileSize, FS.md5);
        newVer.addProperty(FS.modifiedBy, factory.currentUserResource())
                .addLiteral(FS.dateModified, WebDAVServlet.timestampLiteral());

        versions = versions.cons(newVer);
        var current = subject.getRequiredProperty(FS.currentVersion).getInt() + 1;
        subject.removeAll(FS.versions)
                .removeAll(FS.currentVersion)
                .addProperty(FS.versions, versions)
                .addLiteral(FS.currentVersion, current);
    }
}
