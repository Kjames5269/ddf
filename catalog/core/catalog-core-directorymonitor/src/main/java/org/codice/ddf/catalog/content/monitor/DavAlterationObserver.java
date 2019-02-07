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

import com.github.sardine.DavResource;
import com.github.sardine.Sardine;
import java.io.IOException;
import java.io.Serializable;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentSkipListSet;
import org.codice.ddf.catalog.content.monitor.synchronizations.CompletionSynchronization;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A webdav implementation of the {@link org.apache.commons.io.monitor.FileAlterationObserver} Uses
 * https://github.com/lookfirst/sardine
 */
public class DavAlterationObserver implements Serializable {

  private static final long serialVersionUID = 42L;

  private static final DavResource[] EMPTY_RESOURCES = new DavResource[] {};

  private final DavEntry rootEntry;

  private static final transient Logger LOGGER =
      LoggerFactory.getLogger(DavAlterationObserver.class);

  private transient Sardine sardine;

  private transient ConcurrentSkipListSet<DavEntry> processing = new ConcurrentSkipListSet<>();

  private EntryAlterationListener listener;

  DavAlterationObserver(final DavEntry rootEntry) {
    if (rootEntry == null) {
      throw new IllegalArgumentException("Root entry is missing");
    }
    this.rootEntry = rootEntry;
  }

  /**
   * Return the directory being observed.
   *
   * @return the directory being observed
   */
  public String getDirectory() {
    return rootEntry.getLocation();
  }

  private final Object listenerLock = new Object();

  /**
   * Add a file system listener.
   *
   * @param listener The file system listener
   */
  void addListener(final EntryAlterationListener listener) {
    synchronized (listenerLock) {
      this.listener = listener;
    }
  }

  /**
   * Remove a file system listener.
   *
   * @param listener The file system listener
   */
  void removeListener(final EntryAlterationListener listener) {
    synchronized (listenerLock) {
      if (listener != null) {
        this.listener = null;
      }
    }
  }

  /**
   * Initialize the observer. Note this means no events will be fired for files that already existed
   * before monitoring started.
   *
   * @param sardine
   */
  public boolean initialize(Sardine sardine) {
    this.sardine = sardine;
    try {
      DavResource davResource = sardine.list(rootEntry.getLocation()).get(0);
      rootEntry.refresh(davResource);
      final DavEntry[] children = doListFiles(rootEntry.getLocation(), rootEntry);
      for (DavEntry child : children) rootEntry.addChild(child);
    } catch (IOException e) {
      // probably means root location was inaccessible
      LOGGER.debug("Failed to initalize against remote {}", rootEntry.getLocation(), e);
      return false;
    }
    return true;
  }

  /** Check whether the file and its children have been created, modified or deleted. */
  void checkAndNotify(Sardine sardine) {
    synchronized (listenerLock) {
      if (listener == null) {
        return;
      }

      this.sardine = sardine;
      if (rootEntry.remoteExists(sardine)) {
        checkAndNotify(rootEntry, rootEntry.getChildren(), listFiles(rootEntry.getLocation()));
      } else {
        // doesn't exist remotely but we're assuming network disconnects
      }
    }
  }

  /**
   * Compare two file lists for files which have been created, modified or deleted.
   *
   * <p>Example: previous: [bcf] incoming: [abdefg] b > a; create b == a; check (edited) c < d;
   * delete f > e; create f == f; check end of previous loop, loop over remaining incoming, create g
   * At the end, we should have [abdefg], have deleted c, and potentially updated b and f
   *
   * <p>All of this is logically equivalent to: Sets.difference(previous, incoming).forEach(delete);
   * Sets.difference(incoming, previous).forEach(create); Sets.intersection(incoming,
   * previous).forEach(check); but in a single iteration instead of three.
   *
   * @param parent The parent entry
   * @param previous The original list of files
   * @param incoming The current list of files
   */
  private void checkAndNotify(
      final DavEntry parent, final List<DavEntry> previous, final DavResource[] incoming) {
    int c = 0;
    final DavEntry[] current =
        incoming.length > 0 ? new DavEntry[incoming.length] : DavEntry.getEmptyEntries();
    // this loop relies on lexicographical sorting, so compareTo < 0 will never be hit
    for (final DavEntry entry : previous) {
      // sorted previous walking through sorted incoming
      while (c < incoming.length
          && entry
                  .getLocation()
                  .compareTo(DavEntry.getLocation(incoming[c].getName(), entry.getParent()))
              > 0) {
        current[c] = createFileEntry(parent, incoming[c]);
        doCreate(current[c]);
        c++;
      }
      // check if existing entry has been modified
      if (c < incoming.length
          && entry
                  .getLocation()
                  .compareTo(DavEntry.getLocation(incoming[c].getName(), entry.getParent()))
              == 0) {
        doMatch(entry, incoming[c]);
        checkAndNotify(entry, entry.getChildren(), listFiles(entry.getLocation()));
        current[c] = entry;
        c++;

      } else {
        // entry no longer exists, so delete it
        checkAndNotify(entry, entry.getChildren(), EMPTY_RESOURCES);
        doDelete(entry);
      }
    }
    // create anything remaining at the end
    for (; c < incoming.length; c++) {
      current[c] = createFileEntry(parent, incoming[c]);
      doCreate(current[c]);
    }
  }

  /**
   * Create a new file entry for the specified file. Does not fire creation.
   *
   * @param parent The parent file entry
   * @param file The file to create an entry for
   * @return A new file entry
   */
  private DavEntry createFileEntry(final DavEntry parent, final DavResource file) {
    final DavEntry entry = parent.newChildInstance(file.getName());
    entry.refresh(file);
    return entry;
  }

  /**
   * List the files. Creates entries for each child. Return should be set on parent.
   *
   * @param file The file to list files for
   * @param entry the parent entry
   * @return The child files
   */
  private DavEntry[] doListFiles(String file, DavEntry entry) {
    final DavResource[] files = listFiles(file);
    final DavEntry[] children =
        files.length > 0 ? new DavEntry[files.length] : DavEntry.getEmptyEntries();
    for (int i = 0; i < files.length; i++) {
      children[i] = createFileEntry(entry, files[i]);
    }
    return children;
  }

  /**
   * Fire directory/file created events to the registered listeners.
   *
   * @param entry The file entry
   */
  private void doCreate(final DavEntry entry) {

    if (!processing.add(entry)) {
      return;
    }

    DavEntry temp = entry.getFromParent();

    if (temp != null) {
      processing.remove(entry);
      return;
    }

    if (entry.isDirectory()) {
      listener.onDirectoryCreate(entry, new CompletionSynchronization<>(entry, this::doNothing));
      final DavResource[] children = listFiles(entry.getLocation());
      for (final DavResource aChild : children) {
        doCreate(createFileEntry(entry, aChild));
      }

      commitCreate(entry, true);

    } else {
      listener.onFileCreate(entry, new CompletionSynchronization<>(entry, this::commitCreate));
    }
  }

  private void commitCreate(final DavEntry entry, boolean success) {
    LOGGER.debug("commitCreate({},{}): Starting...", entry.getName(), success);
    if (success) {
      entry.commit();
      entry.getParent().ifPresent(e -> e.addChild(entry));
    }
    processing.remove(entry);
  }

  /**
   * Fire directory/file change events to the registered listeners.
   *
   * @param entry The previous file system entry
   * @param file The current file
   */
  private void doMatch(final DavEntry entry, final DavResource file) {
    if (entry.hasChanged(file)) {

      if (!processing.add(entry)) {
        return;
      }
      if (!entry.hasChanged(file)) {
        //  Another thread must have beat us here as we're no longer changed.
        processing.remove(entry);
        return;
      }

      if (entry.isDirectory()) {
        listener.onDirectoryChange(entry, new CompletionSynchronization<>(entry, this::doNothing));
      } else {
        listener.onFileChange(entry, new CompletionSynchronization<>(entry, this::commitMatch));
      }
    }
  }

  private void commitMatch(final DavEntry entry, boolean success) {
    LOGGER.debug("commitMatch({},{}): Starting...", entry.getName(), success);
    if (success) {
      entry.commit();
    }
    processing.remove(entry);
  }

  /**
   * Fire directory/file delete events to the registered listeners.
   *
   * @param entry The file entry
   */
  private void doDelete(final DavEntry entry) {

    if (!processing.add(entry)) {
      return;
    }
    if (entry.getFromParent() == null) {
      //  If we don't exist in the parent another thread beat us here.
      processing.remove(entry);
      return;
    }

    if (entry.isDirectory()) {
      listener.onDirectoryDelete(entry, new CompletionSynchronization<>(entry, this::doNothing));
    } else {
      listener.onFileDelete(entry, new CompletionSynchronization<>(entry, this::commitDelete));
    }
  }

  private void commitDelete(final DavEntry entry, boolean success) {
    LOGGER.debug("commitDelete({},{}): Starting...", entry.getName(), success);
    if (success) {
      entry.getParent().ifPresent(e -> e.removeChild(entry));
      entry.commit();
    }
    processing.remove(entry);
  }

  private void doNothing(DavEntry davEntry, Boolean aBoolean) {
    processing.remove(davEntry);
  }

  /**
   * List the contents of a directory
   *
   * @param file The file to list the contents of
   * @return the directory contents or a zero length array if the empty or the file is not a
   *     directory
   */
  private DavResource[] listFiles(final String file) {
    DavResource[] children = null;
    try {
      List<DavResource> list = sardine.list(file);
      // the returned list includes the parent
      if (list.size() > 1 && list.get(0).isDirectory()) {
        List<DavResource> resourceList = list.subList(1, list.size());
        // lexicographical sorting
        resourceList.sort(Comparator.comparing(DavResource::getName));
        children = resourceList.toArray(new DavResource[0]);
      }
    } catch (IOException e) {
      // if it doesn't exist it can't have children
      children = EMPTY_RESOURCES;
    }
    if (children == null) {
      children = EMPTY_RESOURCES;
    }
    return children;
  }

  /**
   * Provide a String representation of this observer.
   *
   * @return a String representation of this observer
   */
  @Override
  public String toString() {
    return String.format(
        "%s[file='%s', listeners=%d]",
        getClass().getSimpleName(), getDirectory(), (listener == null) ? 0 : 1);
  }

  private void readObject(java.io.ObjectInputStream in) throws IOException, ClassNotFoundException {
    in.defaultReadObject();
  }

  public void onLoad() {
    rootEntry.initialize();
  }
}
