import React from 'react';
import './TopBar.css';
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import config from "../../config";
import UserMenu from "../UserMenu/UserMenu";

function TopBar(props) {
    const { classes } = props;

    const handleLogout = () => { window.location.href = config.logoutUrl }

    return (
        <AppBar position="absolute" className={classes.appBar}>
            <Toolbar>
                <Typography variant="title" color="inherit" noWrap className={classes.flex}>
                    Workspace name
                </Typography>
                <UserMenu onLogout={handleLogout}></UserMenu>
            </Toolbar>
        </AppBar>
    );
}

export default TopBar;


