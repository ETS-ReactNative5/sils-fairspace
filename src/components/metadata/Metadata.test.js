import Metadata from "./Metadata"
import React from 'react';
import {mount} from "enzyme";

function flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
}

let mockMetadataStore;

beforeEach(() => {
    mockMetadataStore = {
        getVocabulary: jest.fn(() => Promise.resolve()),
        get: jest.fn(() => Promise.resolve())
    }
});

it('shows error when no subject provided', () => {
    const wrapper = mount(<Metadata subject={""} metadataStore={mockMetadataStore} />);
    return flushPromises().then(() => {
        wrapper.update();
    }).then(() => {
        const result = wrapper.find("li");
        expect(result.length).toEqual(0);
        expect(wrapper.text()).toEqual("No subject given to retrieve metadata for");
    });
});
