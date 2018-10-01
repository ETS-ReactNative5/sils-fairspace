import React from 'react';
import ErrorDialog from "../../error/ErrorDialog";
import UploadButton from "../buttons/UploadButton/UploadButton";
import CreateDirectoryButton from "../buttons/CreateDirectoryButton/CreateDirectoryButton";
import Icon from "@material-ui/core/Icon";
import IconButton from "@material-ui/core/IconButton";
import {ContentCopy, ContentCut, ContentPaste} from "mdi-material-ui";
import Badge from "@material-ui/core/Badge";
import {connect} from 'react-redux'
import {copy, cut, paste} from "../../../actions/clipboard";
import {createDirectory, uploadFiles, fetchFilesIfNeeded} from "../../../actions/files";

function FileOperations(props) {
    const {numClipboardItems, disabled, openedPath, selectedPath, openedCollection, dispatch} = props;

    function refreshFiles() {
        dispatch(fetchFilesIfNeeded(openedCollection, openedPath))
    }

    function handleCut(e) {
        e.stopPropagation()
        dispatch(cut(openedPath, selectedPath))
    }
    function handleCopy(e) {
        e.stopPropagation()
        dispatch(copy(openedPath, selectedPath))
    }
    function handlePaste(e) {
        e.stopPropagation()
        dispatch(paste(openedCollection, openedPath))
            .then(refreshFiles)
            .catch(err => {
                ErrorDialog.showError(err, "An error occurred while pasting your contents");
            })
    }

    function handleUpload(files) {
        if (files && files.length > 0) {
            return dispatch(uploadFiles(openedCollection, openedPath, files))
                .then(() => files)
                .catch(err => {
                    ErrorDialog.showError(err, "An error occurred while uploading files", () => handleUpload(files));
                });
        } else {
            return Promise.resolve([]);
        }
    }

    function handleCreateDirectory(name) {
        return dispatch(createDirectory(openedCollection, openedPath, name))
            .then(refreshFiles)
            .catch(err => {
                if(err.status === 405) {
                    // Directory already exists
                    ErrorDialog.showError(err, "A directory or file with this name already exists. Please choose another name");
                    return false;
                } else {
                    ErrorDialog.showError(err, "An error occurred while creating directory", () => handleCreateDirectory(name));
                    return true;
                }
            });
    }

    function addBadgeIfNotEmpty(badgeContent, children) {
        if(badgeContent) {
            return <Badge badgeContent={badgeContent} color="primary">
                {children}
            </Badge>
        } else {
            return children;
        }
    }

    return (<React.Fragment>
        <IconButton
            aria-label="Copy"
            onClick={handleCopy}
            disabled={selectedPath.length === 0 || disabled}>
            <ContentCopy/>
        </IconButton>
        <IconButton
            aria-label="Cut"
            onClick={handleCut}
            disabled={selectedPath.length === 0 || disabled}>
            <ContentCut/>
        </IconButton>
        <IconButton
            aria-label="Paste"
            onClick={handlePaste}
            disabled={numClipboardItems === 0 || disabled}>
            {addBadgeIfNotEmpty(
                numClipboardItems,
                <ContentPaste/>
            )}
        </IconButton>
        <CreateDirectoryButton
            aria-label="Create directory"
            onCreate={(name) => handleCreateDirectory(name)}
            disabled={disabled}>
            <Icon>create_new_folder</Icon>
        </CreateDirectoryButton>

        <UploadButton
            color="primary"
            aria-label="Upload"
            onUpload={(files) => handleUpload(files)}
            onDidUpload={refreshFiles}
            disabled={disabled}>
            <Icon>cloud_upload</Icon>
        </UploadButton>
    </React.Fragment>)
}

const mapStateToProps = (state) => ({
    selectedPath: state.collectionBrowser.selectedPath,
    numClipboardItems: state.clipboard.filenames ? state.clipboard.filenames.length : 0,
})

export default connect(mapStateToProps)(FileOperations);
