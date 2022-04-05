import React, {useContext, useEffect, useState} from 'react';
import {withRouter} from "react-router-dom";
import Button from "@material-ui/core/Button";
import CollectionEditor from './CollectionEditor';
import CollectionList from "./CollectionList";
import CollectionsContext from "./CollectionsContext";
import UserContext from "../users/UserContext";
import UsersContext from "../users/UsersContext";
import MessageDisplay from "../common/components/MessageDisplay";
import LoadingInlay from "../common/components/LoadingInlay";
import {getDisplayName} from "../users/userUtils";
import type {User} from "../users/UsersAPI";
import type {Collection} from "./CollectionAPI";
import {getCollectionAbsolutePath} from "./collectionUtils";

type ContextualCollectionBrowserProperties = {
    history: History;
    workspaceIri: string;
    isSelected: (any) => boolean;
    toggleCollection: (any) => void;
    setBusy: () => void;
}

type CollectionBrowserProperties = ContextualCollectionBrowserProperties & {
    loading: boolean;
    error: Error;
    collections: Collection[];
    users: User[];
    showDeleted: boolean;
    canAddCollection: boolean;
}

export const CollectionBrowser = (props: CollectionBrowserProperties) => {
    const {
        loading = false,
        collections = [],
        isSelected = () => false,
        toggleCollection = () => {},
        users = [],
        canAddCollection = true,
        setBusy = () => {},
        showDeleted, history, error
    } = props;

    const [addingNewCollection, setAddingNewCollection] = useState(false);
    const handleAddCollectionClick = () => setAddingNewCollection(true);
    const handleCollectionClick = (collection) => {
        toggleCollection(collection);
    };

    const handleCollectionDoubleClick = (collection) => {
        history.push(encodeURI(getCollectionAbsolutePath(collection.name)));
    };

    const handleCancelAddCollection = () => setAddingNewCollection(false);

    const renderCollectionList = () => {
        collections.forEach(collection => {
            collection.creatorDisplayName = getDisplayName(users.find(u => u.iri === collection.createdBy));
        });
        return (
            <>
                <CollectionList
                    collections={collections}
                    isSelected={isSelected}
                    onCollectionClick={handleCollectionClick}
                    onCollectionDoubleClick={handleCollectionDoubleClick}
                    showDeleted={showDeleted}
                />
                {addingNewCollection ? (
                    <CollectionEditor
                        setBusy={setBusy}
                        onClose={handleCancelAddCollection}
                        workspace={workspace}
                    />
                ) : null}
            </>
        );
    };

    if (error) {
        return <MessageDisplay message="An error occurred while loading collections" />;
    }

    return (
        <>
            {loading ? <LoadingInlay /> : renderCollectionList()}
            {
                canAddCollection
                && (
                    <Button
                        style={{marginTop: 8}}
                        color="primary"
                        variant="contained"
                        aria-label="Add"
                        title="Create a new collection"
                        onClick={handleAddCollectionClick}
                    >
                    New
                    </Button>
                )
            }
        </>
    );
};

const ContextualCollectionBrowser = (props: ContextualCollectionBrowserProperties) => {
    const {currentUserError, currentUserLoading} = useContext(UserContext);
    const {users, usersLoading, usersError} = useContext(UsersContext);
    const {collections, collectionsLoading, collectionsError, showDeleted, setShowDeleted} = useContext(CollectionsContext);
    const {showDeletedCollections} = props;

    const canAdd = window.location.pathname === '/workspace';

    useEffect(() => setShowDeleted(showDeletedCollections), [setShowDeleted, showDeletedCollections]);

    return (
        <CollectionBrowser
            {...props}
            collections={collections}
            users={users}
            canAddCollection={canAdd}
            showDeleted={showDeleted}
            loading={collectionsLoading || currentUserLoading || usersLoading}
            error={collectionsError || currentUserError || usersError}
        />
    );
};

export default withRouter(ContextualCollectionBrowser);
