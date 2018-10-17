import React from 'react';
import FileBrowser from "../../components/collections/FileBrowser/FileBrowser";
import WithInfoDrawer from "../../components/collections/WithInfoDrawer/WithInfoDrawer";
import asPage from "../../containers/asPage/asPage";

function Files(props) {
    const {match: { params }} = props;

    return (
        <WithInfoDrawer>
            <FileBrowser
                openedCollectionId={parseInt(params.collection, 10)}
                openedPath={params.path ? '/' + params.path : '/'}
            />
        </WithInfoDrawer>
    );
}

export default asPage(Files);



