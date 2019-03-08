import React from 'react';
import {shallow} from "enzyme";
import {FileOperations} from "./FileOperations";

describe('FileOperations', () => {
    it('Resolves naming conflicts on upload', () => {
        const uploadFiles = jest.fn(() => Promise.resolve());
        const fetchFilesIfNeeded = jest.fn();

        const wrapper = shallow(<FileOperations
            classes={{}}
            selectedPaths={[]}
            uploadFiles={uploadFiles}
            fetchFilesIfNeeded={fetchFilesIfNeeded}
            openedPath="opened/Path"
            existingFiles={['file1.txt', 'file2.txt', 'file2 (1).txt', 'file2 (2).txt']}
        />);

        const files = [{name: 'file1.txt'}, {name: 'file2.txt'}, {name: 'file3.txt'}];
        return wrapper.instance().handleUpload(files)
            .then(() => {
                expect(uploadFiles.mock.calls.length).toEqual(1);
                expect(uploadFiles.mock.calls[0][0]).toEqual('opened/Path');
                expect(uploadFiles.mock.calls[0][1]).toEqual(
                    [{
                        name: "file1 (1).txt",
                        value: {name: "file1.txt"}
                    },
                    {
                        name: "file2 (3).txt",
                        value: {name: "file2.txt"}
                    },
                    {
                        name: "file3.txt",
                        value: {name: "file3.txt"}
                    }]
                );
                expect(fetchFilesIfNeeded.mock.calls.length).toEqual(1);
                expect(fetchFilesIfNeeded.mock.calls[0][0]).toEqual('opened/Path');
            });
    });
});

describe('handleCreateDirectory', () => {
    it('should return false for 405 error', () => {
        const createDirectory = jest.fn(() => Promise.reject(new Error({response: {status: 405}})));
        const instance = shallow(<FileOperations selectedPaths={[]} createDirectory={createDirectory} classes={{}} />).instance();

        instance.handleCreateDirectory()
            .then(result => {
                expect(result).toEqual(false);
            });
    });
});
