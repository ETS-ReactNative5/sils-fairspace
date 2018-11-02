import {fetchSubjectByPathIfNeeded} from "../../actions/metadata";
import connect from "react-redux/es/connect/connect";
import ErrorMessage from "../error/ErrorMessage";
import React from "react";
import Metadata from "./Metadata";

export class PathMetadata extends React.Component {
    componentDidMount() {
        this.load();
    }


    load() {
        const {dispatch, path, subject} = this.props;

        if (!subject && path) {
            dispatch(fetchSubjectByPathIfNeeded(path))
        }
    }

    render() {
        // putting dispatch here to avoid it being passed down to children
        const {subject, error, loading, ...otherProps} = this.props;

        if (error) {
            return (<ErrorMessage message="An error occurred while determining metadata subject"/>)
        } else if (loading) {
            return (<div>Loading...</div>)
        } else if (!subject) {
            return (<div>No metadata found</div>)
        } else {
            return (<Metadata
                subject={subject}
                {...otherProps}
            />);
        }
    }
}

const mapStateToProps = (state, ownProps) => {
    const subjectByPath = state.cache.subjectByPath;
    const subject = subjectByPath && subjectByPath[ownProps.path];

    // If there is no subject by path (not even pending)
    // some error occurred.
    if (!subject) {
        return { }
    }

    return {
        loading: subject.pending,
        error: subject.error,
        subject: subject.data
    }
}

export default connect(mapStateToProps)(PathMetadata)
