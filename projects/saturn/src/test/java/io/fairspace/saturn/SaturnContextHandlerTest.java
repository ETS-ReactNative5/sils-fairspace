package io.fairspace.saturn;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.fairspace.saturn.auth.OAuthAuthenticationToken;
import io.fairspace.saturn.config.ConfigLoader;
import org.eclipse.jetty.http.MimeTypes;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import static io.fairspace.saturn.auth.OAuthAuthenticationToken.AUTHORITIES_CLAIM;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

@RunWith(MockitoJUnitRunner.class)
public class SaturnContextHandlerTest {
    @Mock
    private Function<HttpServletRequest, OAuthAuthenticationToken> authenticator;
    @Mock
    private Request baseRequest;
    @Mock
    private HttpServletRequest request;
    @Mock
    private HttpServletResponse response;
    @Mock
    private RequestDispatcher requestDispatcher;
    @Mock
    private Handler nextHandler;

    private StringWriter writer;

    private SaturnContextHandler handler;

    @Before
    public void before() throws IOException {
        handler = new SaturnContextHandler(ConfigLoader.CONFIG.auth, authenticator);
        handler.setHandler(nextHandler);

        writer = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(writer));
        when(request.getRequestDispatcher(any())).thenReturn(requestDispatcher);
    }

    @Test
    public void healthEndpointCanBeAccessedWithoutAuth() throws IOException, ServletException {
        handler.handle("/api/v1/health/", baseRequest, request, response);

        verifyIfRequestWasPassedToNextHandler(true);
    }


    @Test
    public void otherEndpointsCanNotBeAccessedWithoutAuth() throws IOException, ServletException {
        when(authenticator.apply(eq(request))).thenReturn(null);

        handler.handle("/api", baseRequest, request, response);

        verifyAuthenticated(false);
    }

    @Test
    public void sparqlRequiresSparqlRole() throws IOException, ServletException {
        when(authenticator.apply(eq(request))).thenReturn(new OAuthAuthenticationToken(null, Map.of(AUTHORITIES_CLAIM, List.of("user"))));

        handler.handle("/api/v1/projects/project/rdf/", baseRequest, request, response);

        verifyAuthenticated(false);

        when(authenticator.apply(eq(request))).thenReturn(new OAuthAuthenticationToken(null, Map.of(AUTHORITIES_CLAIM, List.of("user", "sparql"))));

        handler.handle("/api/v1/projects/project/rdf/", baseRequest, request, response);

        verify(requestDispatcher).forward(request, response);
    }

    @Test
    public void vocabularyCanBeAccessedWithoutAdditionalRoles() throws IOException, ServletException {
        when(authenticator.apply(eq(request))).thenReturn(new OAuthAuthenticationToken(null, Map.of(AUTHORITIES_CLAIM, List.of("user"))));
        when(request.getMethod()).thenReturn("GET");

        handler.handle("/api/v1/projects/project/vocabulary/", baseRequest, request, response);

        verifyAuthenticated(true);
    }

    @Test
    public void vocabularyEditingRequiresDatastewardRole() throws IOException, ServletException {
        when(authenticator.apply(eq(request))).thenReturn(new OAuthAuthenticationToken(null, Map.of(AUTHORITIES_CLAIM, List.of("user"))));
        when(request.getMethod()).thenReturn("PUT");

        handler.handle("/api/v1/projects/project/vocabulary/", baseRequest, request, response);

        verifyAuthenticated(false);

        when(authenticator.apply(eq(request))).thenReturn(new OAuthAuthenticationToken(null, Map.of(AUTHORITIES_CLAIM, List.of("user", "datasteward"))));
        when(request.getMethod()).thenReturn("PUT");

        handler.handle("/api/v1/projects/project/vocabulary/", baseRequest, request, response);

        verifyAuthenticated(true);
    }

    @Test
    public void otherEndpointsCanBeAccessedWithValidAuth() throws IOException, ServletException {
        when(authenticator.apply(eq(request))).thenReturn(new OAuthAuthenticationToken(null, Map.of(AUTHORITIES_CLAIM, List.of("user"))));

        handler.handle("/api/v1/some/", baseRequest, request, response);

        verifyAuthenticated(true);
    }

    @Test
    public void anythingCanBeAccessedByCoordinator() throws IOException, ServletException {
        var token = new OAuthAuthenticationToken(null, Map.of(AUTHORITIES_CLAIM, List.of("coordinator")));
        when(authenticator.apply(eq(request))).thenReturn(token, token, token, token);

        handler.handle("/api/v1/projects/project/metadata/", baseRequest, request, response);
        verifyAuthenticated(true);

        handler.handle("/api/v1/projects/project/webdav/path/", baseRequest, request, response);
        verifyAuthenticated(true);

        handler.handle("/api/v1/projects/project/rdf/", baseRequest, request, response);
        verify(requestDispatcher).forward(request, response);

        handler.handle("/api/v1/projects/project/vocabulary/", baseRequest, request, response);
        verifyAuthenticated(true);
    }

    @Test
    public void errorMessageIsSentCorrectly() throws IOException, ServletException {
        when(authenticator.apply(eq(request))).thenReturn(null);

        handler.handle("/api", baseRequest, request, response);

        verifyAuthenticated(false);

        // Verify the response
        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(response).setContentType(MimeTypes.Type.APPLICATION_JSON.toString());

        ObjectMapper mapper = new ObjectMapper();
        Map errorBody = mapper.readValue(writer.toString(), Map.class);
        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, errorBody.get("status"));
        assertNotNull(errorBody.get("message"));
    }

    private void verifyAuthenticated(boolean success) {
        verifyIfRequestWasPassedToNextHandler(success);
    }

    private void verifyIfRequestWasPassedToNextHandler(boolean success) {
        try {
            verify(nextHandler, times(success ? 1 : 0)).handle(any(), any(), any(), any());
            reset(nextHandler);
        } catch (Exception e) {
            fail();
        }
    }
}
