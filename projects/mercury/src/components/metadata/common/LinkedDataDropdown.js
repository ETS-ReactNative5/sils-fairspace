import React, {useEffect, useState} from 'react';

import searchAPI from "../../../services/SearchAPI";
import {linkLabel, propertyHasValue} from "../../../utils/linkeddata/metadataUtils";
import {LoadingInlay, MessageDisplay} from "../../common";
import Dropdown from './values/Dropdown';
import {SEARCH_DROPDOWN_DEFAULT_SIZE} from "../../../constants";

const LinkedDataDropdown = ({types, property, ...otherProps}) => {
    const [fetchedItems, setFetchedItems] = useState(null);
    const [error, setError] = useState(null);
    const [queries, setQueries] = useState([]);
    const [query, setQuery] = useState(null);

    useEffect(() => {
        setFetchedItems(null);
        setError(null);
        searchAPI()
            .searchLinkedData({types: types || [property.className], query, size: SEARCH_DROPDOWN_DEFAULT_SIZE})
            .then(({items}) => {
                setFetchedItems(items);
            })
            .catch(setError);
    }, [property.className, types, query]);

    useEffect(() => {
        setTimeout(() => {
            setQuery(queries[queries.length - 1]);
        }, 600);
    }, [queries]);

    if (error) {
        return <MessageDisplay withIcon={false} message={error.message} />;
    }

    if (!fetchedItems) {
        return <LoadingInlay />;
    }

    const options = fetchedItems
        .map(({id, label, name, value}) => {
            const disabled = propertyHasValue(property, {id, value});
            const l = (label && label[0]) || (name && name[0]) || linkLabel(id, true);

            return {
                disabled,
                label: l,
                id,
            };
        });

    const onTextInputChange = (e) => {
        setQueries([...queries, e.target.value]);
    };

    return (
        <Dropdown {...otherProps} onTextInputChange={onTextInputChange} options={options} />
    );
};

export default LinkedDataDropdown;
