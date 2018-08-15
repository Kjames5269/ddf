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
package org.codice.ddf.platform.error.injector;

import com.google.common.collect.ImmutableMap;
import java.lang.reflect.Field;
import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.servlet.ServletContext;
import org.codice.ddf.platform.error.servlet.ErrorServlet;
import org.eclipse.jetty.servlet.ErrorPageErrorHandler;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.osgi.framework.*;
import org.osgi.framework.hooks.service.EventListenerHook;
import org.osgi.framework.hooks.service.ListenerHook.ListenerInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/* TODO:
   Unfortunatly the only way I've found to get from a servlet to a servletHolder is by using Field
   ...
   I don't like it but it may be worth abstracting that to a method.
 */


public class ErrorPageInjector implements EventListenerHook {

  private final String errorPagePath = "/ErrorServlet";
  private ImmutableMap<String, String> errorCodesMap =
      new ImmutableMap.Builder<String, String>()
          .put("400", errorPagePath)
          .put("401", errorPagePath)
          .put("403", errorPagePath)
          .put("404", errorPagePath)
          .put("405", errorPagePath)
          .put("406", errorPagePath)
          .put("500", errorPagePath)
          .put("501", errorPagePath)
          .put("502", errorPagePath)
          .put("503", errorPagePath)
          .put("504", errorPagePath)
          .build();

  private static final Logger LOGGER = LoggerFactory.getLogger(ErrorPageInjector.class);

  private final ScheduledExecutorService executorService;

  public ErrorPageInjector(ScheduledExecutorService executorService) {
    this.executorService = executorService;
  }

  BundleContext getContext() {
    final Bundle cxfBundle = FrameworkUtil.getBundle(ErrorPageInjector.class);
    if (cxfBundle != null) {
      return cxfBundle.getBundleContext();
    }
    return null;
  }

  @Override
  public void event(ServiceEvent event, Map<BundleContext, Collection<ListenerInfo>> listeners) {
    if (event.getType() == ServiceEvent.REGISTERED) {
      Bundle refBundle = event.getServiceReference().getBundle();
      BundleContext bundlectx = refBundle.getBundleContext();
      Object service = bundlectx.getService(event.getServiceReference());
      if (service instanceof ServletContext) {
        injectErrorPage((ServletContext) service, refBundle);
      }
    }
  }

  public void init() {
    executorService.schedule(this::checkForMissedServletContexts,1, TimeUnit.SECONDS);
  }

  private void checkForMissedServletContexts() {
    try {
      BundleContext context = getContext();
      if (context == null) {
        return; // bundle is probably refreshing
      }
      Collection<ServiceReference<ServletContext>> references =
              context.getServiceReferences(ServletContext.class, null);
      for (ServiceReference<ServletContext> reference : references) {
        Bundle refBundle = reference.getBundle();
        BundleContext bundlectx = refBundle.getBundleContext();
        ServletContext service = bundlectx.getService(reference);

        if (service.getFilterRegistration(DELEGATING_FILTER) == null) {
          LOGGER.error(
                  "Platform filter delegate failed to start in time to inject itself into {} {}. This means the {} servlet will not properly attach the user subject to requests. Attempting to resolve the issue by restarting the bundle.",
                  refBundle.getSymbolicName(),
                  refBundle.getBundleId(),
                  refBundle.getSymbolicName());

          // Restarting the missed servlet context bundle so the injector will be able to perform
          // its job.
          refBundle.stop();
          refBundle.start();
        }
      }

    } catch (InvalidSyntaxException | BundleException e) {
      LOGGER.error(
              "Problem checking ServletContexts for DelegateServletFilter injections. One of the servlets running might not have all of the needed filters injected. A system restart is recommended. See debug logs for additional details.");
      LOGGER.debug("Additional Details:", e);
    }
  }

  private void injectErrorPage(ServletContext context, Bundle refBundle) {

    Field field;
    try {
      // this grabs the enclosing instance class, which is actually a private class
      // this is the only way to do this in Java
      field = context.getClass().getDeclaredField("this$0");
      field.setAccessible(true);
    } catch (NoSuchFieldException e) {
      LOGGER.warn(
          "Unable to find enclosing class of ServletContext for delegating the error page. The default jetty errors will display in the browser",
          e);

      return;
    }
    ServletHandler handler;

    // need to grab the servlet context handler so we can get down to the handler, which is what we
    // really need
    ServletContextHandler httpServiceContext;
    try {
      httpServiceContext = (ServletContextHandler) field.get(context);
    } catch (IllegalAccessException e) {
      LOGGER.warn(
          "Unable to get the ServletContextHandler for {}. Jetty's default error page will be used for this context",
          refBundle.getSymbolicName(),
          e);

      return;
    }

    // now that we have the handler, we can add in our own ErrorServlet
    handler = httpServiceContext.getServletHandler();

    ServletHolder errorServletHolder = new ServletHolder(new ErrorServlet());
    errorServletHolder.setServletHandler(handler);
    try {
      errorServletHolder.start();
      errorServletHolder.initialize();
    } catch (Exception e) {
      LOGGER.warn(
          "Unable to initialize an errorServletHolder for {}. Jetty's default error page will be used for this context",
          refBundle.getSymbolicName(),
          e);

      return;
    }
    handler.addServletWithMapping(errorServletHolder, errorPagePath);

    ErrorPageErrorHandler errorPageErrorHandler = new ErrorPageErrorHandler();
    errorPageErrorHandler.setErrorPages(errorCodesMap);
    httpServiceContext.setErrorHandler(errorPageErrorHandler);
  }
}
