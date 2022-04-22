package io.fairspace.saturn.services.users;

import io.fairspace.saturn.config.*;
import io.fairspace.saturn.rdf.dao.*;
import io.fairspace.saturn.rdf.transactions.*;
import org.eclipse.jetty.server.*;
import org.junit.*;
import org.junit.runner.*;
import org.keycloak.admin.client.resource.*;
import org.keycloak.representations.idm.*;
import org.mockito.*;
import org.mockito.junit.*;

import java.util.*;
import java.util.stream.*;

import static io.fairspace.saturn.TestUtils.*;
import static io.fairspace.saturn.auth.RequestContext.getCurrentRequest;
import static io.fairspace.saturn.rdf.SparqlUtils.generateMetadataIri;
import static org.apache.jena.query.DatasetFactory.createTxnMem;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class UserServiceTest {
    private org.eclipse.jetty.server.Request request;
    private Transactions tx = new SimpleTransactions(createTxnMem());

    @Mock
    private UsersResource usersResource;
    private UserService userService;
    User user;
    Authentication.User userAuthentication;
    User admin;
    Authentication.User adminAuthentication;
    List<UserRepresentation> keycloakUsers;

    private void selectRegularUser() {
        lenient().when(request.getAuthentication()).thenReturn(userAuthentication);
    }

    private void selectAdmin() {
        lenient().when(request.getAuthentication()).thenReturn(adminAuthentication);
    }

    @Before
    public void setUp() {
        setupRequestContext();
        request = getCurrentRequest();

        tx.executeWrite(model -> {
            userAuthentication = mockAuthentication("user");
            user = createTestUser("user", false);
            new DAO(model).write(user);
            adminAuthentication = mockAuthentication("admin");
            admin = createTestUser("admin", true);
            new DAO(model).write(admin);
        });

        keycloakUsers = List.of(user, admin).stream().map(
                user -> {
                    var keycloakUser = new UserRepresentation();
                    keycloakUser.setId(user.getId());
                    keycloakUser.setUsername(user.getUsername());
                    return keycloakUser;
                })
                .collect(Collectors.toList());
        when(usersResource.list()).thenReturn(keycloakUsers);

        userService = new UserService(ConfigLoader.CONFIG.auth, tx, usersResource);

        selectAdmin();
    }

    private void triggerKeycloakUserUpdate() {
        selectAdmin();
        var update = new UserRolesUpdate();
        update.setId("user");
        // Invalidate users cache in the user service
        userService.update(update);

        // Change Keycloak info, triggering a database write
        // when the user cache is refreshed
        keycloakUsers.get(0).setLastName("Updated");
        when(usersResource.list()).thenReturn(keycloakUsers);
    }

    /**
     * In some parts of the application, the current user object is requested
     * to perform access checks. Requesting the current user may trigger a read from
     * Keycloak, as the list of users is cached by Saturn only for limited time (see
     * {@link UserService#UserService(Config.Auth, Transactions, UsersResource)}).
     *
     * While fetching the list of users, Saturn may update the user objects in the RDF database
     * when some user properties have changed in Keycloak or when new users have been added.
     * That update did trigger a transaction error when occurring during a read action, such as fetching
     * the list of workspaces (deprecated) (see <a href="https://thehyve.atlassian.net/browse/VRE-1455">VRE-1455</a>).
     *
     * This test ensures that such updates happen asynchronously, not interfering with the
     * ongoing read transaction.
     */
    @Test
    public void testFetchUsersWhileFetchingWorkspaces() throws InterruptedException {
        var pristineUser = tx.calculateRead(model ->
                new DAO(model).read(User.class, generateMetadataIri("user"))
        );
        Assert.assertEquals("user", pristineUser.getName());

        triggerKeycloakUserUpdate();

        selectRegularUser();
        // Fetching the current user will trigger saving the updated user (in a write transactions) during a read transaction.
        userService.currentUser();

        Thread.sleep(500);
        var updatedUser = tx.calculateRead(model ->
                new DAO(model).read(User.class, generateMetadataIri("user"))
        );
        // Check that the updated user was correctly saved to the database.
        Assert.assertEquals("Updated", updatedUser.getName());
    }
}
