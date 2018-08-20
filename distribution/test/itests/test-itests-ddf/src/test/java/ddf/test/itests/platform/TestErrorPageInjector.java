/**
 * Copyright (c) Codice Foundation
 *
 * <p>This is free software: you can redistribute it and/or modify it under the terms of the GNU
 * Lesser General Public License as published by the Free Software Foundation, either version 3 of
 * the License, or any later version.
 *
 * <p>This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details. A copy of the GNU Lesser General Public
 * License is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 */
package ddf.test.itests.platform;

import static org.hamcrest.MatcherAssert.assertThat;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;
import javax.servlet.ServletContext;
import org.codice.ddf.itests.common.AbstractIntegrationTest;
import org.codice.ddf.test.common.LoggingUtils;
import org.eclipse.jetty.servlet.ErrorPageErrorHandler;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.ops4j.pax.exam.junit.PaxExam;
import org.ops4j.pax.exam.spi.reactors.ExamReactorStrategy;
import org.ops4j.pax.exam.spi.reactors.PerSuite;
import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.Constants;
import org.osgi.framework.ServiceReference;

@RunWith(PaxExam.class)
@ExamReactorStrategy(PerSuite.class)
public class TestErrorPageInjector extends AbstractIntegrationTest {

  public static final String ADMIN = "admin";
  //  100 % tilt
  @SuppressWarnings("unchecked")
  private ServiceReference<ServletContext>[] setup() throws Exception {
    try {
      LOGGER.error("Entering B e f o r e");
      waitForSystemReady();
      // Start the services needed for testing.
      getServiceManager().startFeature(true, "security-services-app");

      BundleContext bundleContext = getServiceManager().getBundleContext();
      return (ServiceReference<ServletContext>[])
          bundleContext.getAllServiceReferences(
              null, "(" + Constants.OBJECTCLASS + "=javax.servlet.ServletContext)");

    } catch (Exception e) {
      LoggingUtils.failWithThrowableStacktrace(e, "Failed in @BeforeExam: ");
    }
    return null;
  }

  @Test
  public void testErrorPagesGotInjected() throws Exception {
    testErrorPagesGotInjectedHelper(setup());
  }

  @Test
  public void testErrorPagesInjectorRestartHavoc() throws Exception {
    ServiceReference<ServletContext>[] references = setup();
    int len = references.length;
    String[] a =
        Arrays.stream(references)
            .map(p -> p.getBundle().getSymbolicName())
            .collect(Collectors.toList())
            .toArray(new String[len]);

    getServiceManager().stopBundle("platform-error-page-injector");
    getServiceManager().restartBundles(Arrays.copyOfRange(a, 0, len / 2));
    getServiceManager().startBundle("platform-error-page-injector");
    getServiceManager().restartBundles(Arrays.copyOfRange(a, len / 2, len));

    getServiceManager().waitForAllBundles();
    testErrorPagesGotInjectedHelper(references);
  }

  @Test
  public void testErrorPageInjectorStartingLast() throws Exception {
    ServiceReference<ServletContext>[] references = setup();
    int len = references.length;
    String[] a =
        Arrays.stream(references)
            .map(p -> p.getBundle().getSymbolicName())
            .collect(Collectors.toList())
            .toArray(new String[len]);
    getServiceManager().stopBundle("platform-error-page-injector");
    getServiceManager().restartBundles(a);
    getServiceManager().startBundle("platform-error-page-injector");

    getServiceManager().waitForAllBundles();
    testErrorPagesGotInjectedHelper(references);
  }

  private void testErrorPagesGotInjectedHelper(ServiceReference<ServletContext>[] references)
      throws Exception {

    if (references == null) {
      LOGGER.error("Hello? Good sir???");
      Bundle[] bundles = getServiceManager().getBundleContext().getBundles();
      for (Bundle bundle : bundles) {
        LOGGER.error(
            "{} : {}", bundle.getSymbolicName(), (bundle.getState() == 32) ? "ACTIVE" : "?");
      }
    }

    for (ServiceReference<ServletContext> reference : references) {
      final Bundle refBundle = reference.getBundle();
      ServletContextHandler httpContext = getHttpContext(reference);

      ErrorPageErrorHandler errorPageErrorHandler =
          (ErrorPageErrorHandler) httpContext.getErrorHandler();
      final Map<String, String> errorPages = errorPageErrorHandler.getErrorPages();
      assertThat(
          "Error page has been injected into " + refBundle.getSymbolicName(),
          !errorPages.isEmpty());
    }
  }

  private ServletContextHandler getHttpContext(ServiceReference<ServletContext> reference)
      throws Exception {

    BundleContext bundlectx = null;
    do
      try {
        final Bundle refBundle = reference.getBundle();
        //  When bundle wait all doesn't work and you're 110% tilt.
        bundlectx = refBundle.getBundleContext();
      } catch (Exception e) {
        Thread.sleep(500);
      }
    while (bundlectx == null);

    ServletContext service = bundlectx.getService(reference);
    Field field = service.getClass().getDeclaredField("this$0");
    field.setAccessible(true);
    return (ServletContextHandler) field.get(service);
  }

  //    Response response =
  //        given()
  //            .auth()
  //            .preemptive()
  //            .basic(ADMIN, ADMIN)
  //            .header("X-Requested-With", "XMLHttpRequest")
  //            .header("Origin", LOGGING_SERVICE_JOLOKIA_URL.getUrl())
  //            .expect()
  //            .statusCode(200)
  //            .when()
  //            .get(LOGGING_SERVICE_JOLOKIA_URL.getUrl());
  //
  //    String bodyString = checkResponseBody(response, LOGGING_SERVICE_JOLOKIA_URL);
  //
  //    final List events = JsonPath.given(bodyString).get("value");
  //    final Map firstEvent = (Map) events.get(0);
  //    final String levelOfFirstEvent = firstEvent.get("level").toString();
  //    final String unknownLevel = LogEvent.Level.UNKNOWN.getLevel();
  //    assertThat(
  //        String.format(
  //            "The level of an event returned by %s should not be %s",
  //            LOGGING_SERVICE_JOLOKIA_URL, unknownLevel),
  //        levelOfFirstEvent,
  //        not(equalTo(unknownLevel)));
  //  }
}
