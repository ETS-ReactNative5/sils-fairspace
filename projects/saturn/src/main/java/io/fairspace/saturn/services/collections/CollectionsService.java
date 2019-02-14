package io.fairspace.saturn.services.collections;

import io.fairspace.saturn.auth.UserInfo;
import io.fairspace.saturn.rdf.QuerySolutionProcessor;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.rdfconnection.RDFConnection;

import java.util.List;
import java.util.function.Supplier;

import static io.fairspace.saturn.commits.CommitMessages.withCommitMessage;
import static io.fairspace.saturn.rdf.SparqlUtils.parseXSDDateTime;
import static io.fairspace.saturn.rdf.SparqlUtils.storedQuery;
import static io.fairspace.saturn.util.ValidationUtils.validate;
import static org.apache.jena.rdf.model.ResourceFactory.createResource;
import static org.apache.jena.system.Txn.calculateWrite;
import static org.apache.jena.system.Txn.executeWrite;

// TODO: Check permissions
public class CollectionsService {
    private final RDFConnection rdf;

    private final Supplier<UserInfo> userInfoSupplier;


    public CollectionsService(RDFConnection rdf, Supplier<UserInfo> userInfoSupplier) {
        this.rdf = rdf;
        this.userInfoSupplier = userInfoSupplier;
    }

    public Collection create(Collection collection) {
        validate(collection.getIri() == null, "Field iri must not be left empty");
        validate(collection.getCreator() == null, "Field creator must not be left empty");
        validate(collection.getLocation() != null, "Field location must be set");
        validate(isDirectoryNameValid(collection.getLocation()), "Invalid location");
        validate(collection.getName() != null && !collection.getName().isEmpty(), "Field prettyName must be set");
        validate(collection.getType() != null, "Field type must be set");

        if (collection.getDescription() == null) {
            collection.setDescription("");
        }

        return withCommitMessage("Create collection " + collection.getName(), () ->
                calculateWrite(rdf, () -> {
                    if (getByDirectoryName(collection.getLocation()) != null) {
                        return null;
                    }

                    rdf.update(storedQuery("coll_create",
                            collection.getName(),
                            collection.getLocation(),
                            collection.getDescription(),
                            collection.getType(),
                            userId()));

                    return getByDirectoryName(collection.getLocation());
                }));
    }

    public Collection get(String iri) {
        var processor = new QuerySolutionProcessor<>(CollectionsService::toCollection);
        rdf.querySelect(storedQuery("coll_get", createResource(iri)), processor);
        return processor.getSingle().orElse(null);
    }

    public Collection getByDirectoryName(String name) {
        var processor = new QuerySolutionProcessor<>(CollectionsService::toCollection);
        rdf.querySelect(storedQuery("coll_get_by_dir", name), processor);
        return processor.getSingle().orElse(null);
    }

    public List<Collection> list() {
        var processor = new QuerySolutionProcessor<>(CollectionsService::toCollection);
        rdf.querySelect(storedQuery("coll_list"), processor);
        return processor.getValues();
    }

    public void delete(String iri) {
        withCommitMessage("Delete collection " + iri, () ->
                executeWrite(rdf, () -> {
                    var existing = get(iri);
                    if (existing == null) {
                        throw new IllegalArgumentException("Couldn't delete " + iri);
                    }
                    rdf.update(storedQuery("coll_delete", createResource(iri), userId()));
                }));
    }

    public Collection update(Collection patch) {
        validate(patch.getIri() != null, "No URI");
        validate(patch.getCreator() == null, "Field creator must not be left empty");

        return withCommitMessage("Update collection " + patch.getName(), () ->
                calculateWrite(rdf, () -> {
                    var existing = get(patch.getIri());
                    if (existing == null) {
                        return null;
                    }

                    validate(patch.getType() == null || patch.getType().equals(existing.getType()),
                            "Cannot change collection's type");

                    rdf.update(storedQuery("coll_update",
                            createResource(patch.getIri()),
                            patch.getName() != null ? patch.getName() : existing.getName(),
                            patch.getDescription() != null ? patch.getDescription() : existing.getDescription(),
                            patch.getLocation() != null ? patch.getLocation() : existing.getLocation(),
                            userId()));

                    return get(patch.getIri());
                })
        );
    }

    private static Collection toCollection(QuerySolution row) {
        var collection = new Collection();
        collection.setIri(row.getResource("iri").toString());
        collection.setType(row.getLiteral("type").getString());
        collection.setName(row.getLiteral("name").getString());
        collection.setLocation(row.getLiteral("path").getString());
        collection.setDescription(row.getLiteral("description").getString());
        collection.setCreator(row.getLiteral("createdBy").getString());
        collection.setDateCreated(parseXSDDateTime(row.getLiteral("dateCreated")));
        collection.setAccess(Access.Manage); // TODO: Check
        return collection;
    }

    private static boolean isDirectoryNameValid(String name) {
        return name.indexOf('\u0000') < 0
                && name.indexOf('/') < 0
                && name.indexOf('\\') < 0
                && name.length() < 128;
    }

    private String userId() {
        if (userInfoSupplier != null) {
            var userInfo = userInfoSupplier.get();
            if (userInfo != null) {
                return userInfo.getUserId();
            }
        }
        return "";
    }
}
