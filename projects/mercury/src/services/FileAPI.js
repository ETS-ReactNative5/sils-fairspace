import {createClient} from "webdav";
import axios from 'axios';
import Config from "./Config/Config";
import {generateUniqueFileName, getFileName, joinPaths} from '../utils/fileUtils';
import {compareBy, comparing} from "../utils/genericUtils";

// Ensure that the client passes along the credentials
const defaultOptions = {withCredentials: true};

// Keep all item properties
const includeDetails = {...defaultOptions, details: true};

axios.interceptors.request.use((config) => {
    if (config.method === 'propfind') {
        config.headers['content-type'] = 'application/xml';
        config.data = `
<propfind xmlns:d="DAV:" xmlns:fs="http://fairspace.io/ontology#">
   <d:prop>
      <fs:iri />
   </d:prop>
   <d:prop>
      <d:resourcetype />
   </d:prop>
   <d:prop>
      <d:getlastmodified />
   </d:prop>
   <d:prop>
      <d:getcontentlength />
   </d:prop>
</propfind>`;
    }
    return config;
}, (error) => Promise.reject(error));

class FileAPI {
    client() {
        if (!this.webDavClient) {
            this.webDavClient = createClient(Config.get().urls.files);
        }
        return this.webDavClient;
    }

    stat(path) {
        return this.client().stat(path, includeDetails)
            .then(result => result.data);
    }

    /**
     * List directory contents
     * @param path      Full path within the collection
     * @returns {Promise<T>}
     */
    list(path) {
        return this.client().getDirectoryContents(path, includeDetails)
            .then(result => result.data)
            .then(files => files.sort(comparing(compareBy('type'), compareBy('filename'))));
    }

    /**
     * Creates a new directory within the current collection
     * @param path      Full path within the collection
     * @returns {*}
     */
    createDirectory(path) {
        return this.client().createDirectory(path, defaultOptions)
            .catch(e => {
                if (e && e.response) {
                    // eslint-disable-next-line default-case
                    switch (e.response.status) {
                        case 403:
                            throw new Error("You do not have authorization to create a directory in this collection.");
                        case 405:
                            throw new Error("A directory or file with this name already exists. Please choose another name");
                    }
                }

                return Promise.reject(e);
            });
    }

    /**
     * Uploads the given files into the provided path
     * @param path
     * @param files
     * @returns Promise<any>
     */
    upload(path, files) {
        if (!files) {
            return Promise.reject(Error("No files given"));
        }

        const allPromises = files.map(({name, value}) => {
            return this.client().putFileContents(`${path}/${name}`, value, defaultOptions)
                .catch(e => {
                    if (e && e.response) {
                        // eslint-disable-next-line default-case
                        switch (e.response.status) {
                            case 403:
                                throw new Error("You do not have authorization to add files to this collection.");
                        }
                    }

                    return Promise.reject(e);
                });
        });

        return Promise.all(allPromises).then(() => files);
    }

    /**
     * It will calls the browser API to open the file if it's 'openable' otherwise the browser will show download dialog
     * @param path
     */
    open(path) {
        const link = this.getDownloadLink(path);
        window.open(link);
    }

    /**
     * It creates a full download like to the path provided
     */
    getDownloadLink = (path = '') => this.client().getFileDownloadLink(path, defaultOptions);

    /**
     * Deletes the file given by path
     * @param path
     * @returns Promise<any>
     */
    delete(path) {
        if (!path) return Promise.reject(Error("No path specified for deletion"));

        return this.client().deleteFile(path, defaultOptions)
            .catch(e => {
                if (e && e.response) {
                    // eslint-disable-next-line default-case
                    switch (e.response.status) {
                        case 403:
                            throw new Error("Could not delete file or directory. Do you have write permissions to the collection?");
                    }
                }

                return Promise.reject(e);
            });

    }

    /**
     * Move the file specified by {source} to {destination}
     * @param source
     * @param destination
     * @returns Promise<any>
     */
    move(source, destination) {
        if (!source) {
            return Promise.reject(Error("No source specified to move"));
        }
        if (!destination) {
            return Promise.reject(Error("No destination specified to move to"));
        }

        if (source === destination) {
            return Promise.resolve();
        }

        // We have to specify the destination ourselves, as the client() adds the fullpath
        // to the
        return this.client().moveFile(source, destination, defaultOptions)
            .catch(e => {
                if (e && e.response) {
                    // eslint-disable-next-line default-case
                    switch (e.response.status) {
                        case 403:
                            throw new Error("Could not move one or more files. Do you have write permission to both the source and destination collection?");
                        case 409:
                            throw new Error("Could not move one or more files. The destination can not be copied to.");
                        case 412:
                            throw new Error("Could not move one or more files. The destination file already exists.");
                    }
                }

                return Promise.reject(e);
            });
    }

    /**
     * Copy the file specified by {source} to {destination}
     * @param source
     * @param destination
     * @returns Promise<any>
     */
    copy(source, destination) {
        if (!source) {
            return Promise.reject(Error("No source specified to copy"));
        }
        if (!destination) {
            return Promise.reject(Error("No destination specified to copy to"));
        }

        return this.client().copyFile(source, destination, defaultOptions)
            .catch(e => {
                if (e && e.response) {
                    // eslint-disable-next-line default-case
                    switch (e.response.status) {
                        case 403:
                            throw new Error("Could not copy one or more files. Do you have write permission to the destination collection?");
                        case 409:
                            throw new Error("Could not copy one or more files. The destination can not be copied to.");
                        case 412:
                            throw new Error("Could not copy one or more files. The destination file already exists.");
                    }
                }

                return Promise.reject(e);
            });
    }

    /**
     * Delete one or more files
     * @param filenames
     * @returns {Promise}
     */
    deleteMultiple(filenames) {
        if (!filenames || filenames.length === 0) {
            return Promise.reject(new Error("No filenames given to delete"));
        }

        return Promise.all(filenames.map(filename => this.delete(filename)));
    }

    /**
     * Move one or more files to a destinationdir
     * @param filePaths
     * @param destinationDir
     * @returns {*}
     */
    movePaths(filePaths, destinationDir) {
        return this.uniqueDestinationPaths(filePaths, destinationDir)
            .then(mapping => Promise.all(mapping.map(([src, dst]) => this.move(src, dst))));
    }

    /**
     * Copies one or more files from to a destinationdir
     * @param filePaths
     * @param destinationDir
     * @returns {*}
     */
    copyPaths(filePaths, destinationDir) {
        return this.uniqueDestinationPaths(filePaths, destinationDir)
            .then(mapping => Promise.all(mapping.map(([src, dst]) => this.copy(src, dst))))
            .catch(e => {
                if (e && e.response) {
                    // eslint-disable-next-line default-case
                    switch (e.response.status) {
                        case 403:
                            throw new Error("Could not copy one or more files. Do you have write permission to the destination collection?");
                        case 409:
                            throw new Error("Could not copy one or more files. The destination can not be copied to.");
                        case 412:
                            throw new Error("Could not copy one or more files. The destination file already exists.");
                    }
                }

                return Promise.reject(e);
            });

    }

    /**
     * Generates unique (non-existing) file paths in the destinationdir adding indices to the file names when necessary
     * @param filePaths
     * @param destinationDir
     * @returns {Promise<Array<Array<string>>>} A list of source/destination combinations. The first entry in an array is the source path, the second entry is the associated unique destination path
     */
    uniqueDestinationPaths(filePaths, destinationDir) {
        return this.list(destinationDir)
            .then(files => files.map(f => f.basename))
            .then(usedNames => filePaths.map(sourceFile => {
                const destinationFilename = generateUniqueFileName(getFileName(sourceFile), usedNames);
                usedNames.push(destinationFilename);
                const destinationFile = joinPaths(destinationDir, destinationFilename);
                return [sourceFile, destinationFile];
            }));
    }
}

export default new FileAPI();
