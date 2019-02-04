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
package org.codice.ddf.catalog.content.monitor;

import java.io.File;
import org.apache.camel.Processor;
import org.apache.camel.component.file.GenericFileEndpoint;
import org.apache.camel.component.file.GenericFileOperations;
import org.apache.camel.component.file.GenericFileProcessStrategy;
import org.apache.commons.io.monitor.FileAlterationObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DurableFileSystemFileConsumer extends AbstractDurableFileConsumer {

  private static final Logger LOGGER = LoggerFactory.getLogger(DurableFileSystemFileConsumer.class);

  private DurableFileAlterationListener listener;

  private AsyncFileAlterationObserver observer;

  DurableFileSystemFileConsumer(
      GenericFileEndpoint<File> endpoint,
      String remaining,
      Processor processor,
      GenericFileOperations<File> operations,
      GenericFileProcessStrategy<File> processStrategy) {
    super(endpoint, remaining, processor, operations, processStrategy);
    listener = new DurableFileAlterationListener(this);
  }

  @Override
  protected boolean doPoll(String sha1) {
    if (observer != null) {
      observer.addListener(listener);
      observer.checkAndNotify();
      observer.removeListener();
      fileSystemPersistenceProvider.storeJson(sha1, observer, observer.getClass());
      return true;
    } else {
      return isMatched(null, null, null);
    }
  }

  @Override
  protected void initialize(String fileName, String sha1) {
    if (fileSystemPersistenceProvider == null) {
      fileSystemPersistenceProvider = new FileSystemPersistenceProvider(getClass().getSimpleName());
    }
    if (observer == null && fileName != null) {
      if (fileSystemPersistenceProvider.loadAllKeys().contains(sha1)) {
        Object tempObserver = fileSystemPersistenceProvider.loadFromJson(sha1, observer.getClass());
        if (tempObserver != null) {
          observer = (AsyncFileAlterationObserver) tempObserver;
          observer.onLoad();
        } else {
          backwardsCompatibility(
              (FileAlterationObserver) fileSystemPersistenceProvider.loadFromPersistence(sha1),
              new AsyncFileAlterationObserver(new File(fileName)));
        }
      } else {
        observer = new AsyncFileAlterationObserver(new File(fileName));
      }
    }
  }

  //  We got an old version.
  private void backwardsCompatibility(
      FileAlterationObserver oldObserver, AsyncFileAlterationObserver newObserver) {
    boolean success = newObserver.initialize();
    if (!success) {
      //  There was an IO error setting up the initial state of the observer
      LOGGER.info("Error initializing the new state of the CDM. retrying on next poll");
      return;
    }
    oldObserver.addListener(listener);
    oldObserver.checkAndNotify();
    oldObserver.removeListener(listener);

    observer = newObserver;
  }

  @Override
  public void shutdown() throws Exception {
    super.shutdown();
    listener.destroy();
  }
}
