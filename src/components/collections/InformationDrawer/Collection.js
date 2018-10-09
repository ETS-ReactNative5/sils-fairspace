import React from 'react';
import Typography from "@material-ui/core/Typography";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Icon from "@material-ui/core/Icon";
import ErrorDialog from "../../error/ErrorDialog";
import {connect} from 'react-redux'
import * as collectionActions from '../../../actions/collections'
import {findById} from "../../../utils/arrayutils";
import {getDisplayName} from "../utils/userUtils";

class Collection extends React.Component {
    constructor(props) {
        super(props);
        this.onDidChangeDetails = props.onDidChangeDetails;

        this.state = {
            collection: props.collection,
            editValues: this.determineEditValues(props.collection),
            editing: false,
            showEditButton: false
        };
    }

    componentWillReceiveProps(props) {
        this.setState({
            collection: props.collection,
            editing: false,
            editValues: this.determineEditValues(props.collection)
        });
    }

    resetValues() {
        this.setState({
            editValues: this.determineEditValues(this.state.collection)
        })
    }

    determineEditValues(collection) {
        return {
            name: collection.name || '',
            description: collection.description || ''
        }
    }

    closeEditDialog() {
        this.setState({editing: false});
    }

    storeChangedDetails(collectionId, parameters) {
        // Update information about the name and collection
        return this.props.updateCollection(collectionId, parameters.name, parameters.description)
    }

    handleCancel() {
        this.resetValues();
        this.closeEditDialog();
    }

    handleChangeDetails() {
        this.closeEditDialog();

        this.storeChangedDetails(this.state.collection.id, this.state.editValues)
            .then(() => {
                let collection = Object.assign(this.state.collection, this.state.editValues);

                if (this.onDidChangeDetails) {
                    this.onDidChangeDetails(collection);
                }
            })
            .catch(e => ErrorDialog.showError(e, "An error occurred while updating collection metadata"));
    }

    handleInputChange(event) {
        let currentEditValues = this.state.editValues;
        currentEditValues[event.target.name] = event.target.value;
        this.setState(currentEditValues);
    }

    handleTextMouseEnter() {
        this.setState({showEditButton: true});
    }

    handleTextMouseLeave() {
        this.setState({showEditButton: false});
    }

    handleTextClick() {
        this.setState({editing: true});
    }

    render() {
        return (
            <div>
                <div
                    onClick={this.handleTextClick.bind(this)}
                    onMouseEnter={this.handleTextMouseEnter.bind(this)}
                    onMouseLeave={this.handleTextMouseLeave.bind(this)}
                >
                    <Typography variant="headline"
                                component='h2'>{this.state.collection.name} {this.state.showEditButton ? (
                        <Icon>edit</Icon>) : ''}</Typography>
                    <Typography gutterBottom variant='subheading'
                                color="textSecondary">Owner: {this.props.creatorFullname}</Typography>
                    <Typography component='p'>{this.state.collection.description}</Typography>
                </div>

                <Dialog
                    open={this.state.editing}
                    onClose={this.closeEditDialog.bind(this)}
                    aria-labelledby="form-dialog-title"
                >
                    <DialogTitle id="form-dialog-title">Edit collection: {this.state.collection.name}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            You can edit the collection name and description here.
                        </DialogContentText>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="name"
                            label="Name"
                            value={this.state.editValues.name}
                            name="name"
                            onChange={this.handleInputChange.bind(this)}
                            fullWidth
                        />
                        <TextField
                            autoFocus
                            margin="dense"
                            multiline={true}
                            id="description"
                            label="Description"
                            name="description"
                            value={this.state.editValues.description}
                            onChange={this.handleInputChange.bind(this)}
                            fullWidth
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={this.handleCancel.bind(this)} color="secondary">
                            Cancel
                        </Button>
                        <Button onClick={this.handleChangeDetails.bind(this)} color="primary">
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>


            </div>
        );
    }
}

const mapStateToProps = ({cache: {users}}, {collection: {creator}}) => {
    const user = findById(users.data, creator);
    return {
        creatorFullname: getDisplayName(user)
    }
};

const mapDispatchToProps = {
    ...collectionActions
};

export default connect(mapStateToProps, mapDispatchToProps)(Collection);




