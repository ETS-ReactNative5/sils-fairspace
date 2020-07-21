import type {User} from "./UsersAPI";
import type {WorkspaceUserRole} from "../workspaces/WorkspacesAPI";
import type {Permission} from "../collections/CollectionAPI";

export function getDisplayName(user) {
    return (user && user.name) || '';
}

export function getEmail(user) {
    return (user && user.email) || '';
}

export const isAdmin = (user) => user && user.admin;
export const isDataSteward = (user) => isAdmin(user);

export const getWorkspaceUsersWithRoles = (users: User[], workspaceRoles: WorkspaceUserRole[]) => {
    const members = [];
    users.forEach(u => {
        const workspaceUser = workspaceRoles.find(wu => wu.iri === u.iri);
        if (workspaceUser) {
            members.push({...u, role: workspaceUser.role});
        }
    });
    return members;
};

export const getUsersWithCollectionAccess = (users: User[], userPermissions: Permission[]) => {
    const results = [];
    users.forEach(u => {
        const permission = userPermissions.find(p => p.user === u.iri);
        if (permission) {
            results.push({...u, access: permission.access});
        }
    });
    return results;
};
