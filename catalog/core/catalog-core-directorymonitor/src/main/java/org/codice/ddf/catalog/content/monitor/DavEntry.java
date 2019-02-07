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
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.Serializable;
import java.io.UncheckedIOException;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentSkipListSet;
import javax.annotation.Nullable;
import javax.validation.constraints.NotNull;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;

/**
 * A webdav implementation of the {@link org.apache.commons.io.monitor.FileEntry} Uses
 * https://github.com/lookfirst/sardine
 */
public class DavEntry implements Serializable, Comparable<DavEntry>, AsyncEntry<DavEntry> {

  private static final long serialVersionUID = -2505664948818681153L;

  private static final DavEntry[] EMPTY_ENTRIES = new DavEntry[0];

  private static final String HTTP = "http";

  private static final String FORSLASH = "/";

  private @Nullable final DavEntry parent;

  private ConcurrentSkipListSet<DavEntry> children = new ConcurrentSkipListSet<>();

  private @Nullable DavResource lastDavSnapshot = null;

  private @Nullable DavResource lastDav = null;

  private File file;

  private String location;

  /** @param location must be fully qualified */
  DavEntry(final String location) {
    this(null, location);
  }

  private DavEntry(final DavEntry parent, final String location) {
    if (location == null) {
      throw new IllegalArgumentException("File is missing");
    }
    this.parent = parent;
    this.location = getLocation(location, Optional.ofNullable(parent));
  }

  static DavEntry[] getEmptyEntries() {
    return EMPTY_ENTRIES;
  }

  public void refresh(DavResource davResource) {

    lastDav = davResource;
    lastDavSnapshot = lastDav;
  }

  DavEntry newChildInstance(String location) {
    return new DavEntry(this, location);
  }

  // construct the fully qualified location from a fully qualified parent and
  // a child relative to the parent
  static String getLocation(String initialLocation, Optional<DavEntry> parent) {
    String location = initialLocation;
    if (parent.isPresent() && !location.startsWith(HTTP)) {
      String parentLocation = parent.get().getLocation();
      if (parentLocation.endsWith(FORSLASH) && location.startsWith(FORSLASH)) {
        location = location.replaceFirst(FORSLASH, "");
      }
      if (!parentLocation.endsWith(FORSLASH) && !location.startsWith(FORSLASH)) {
        location = FORSLASH + location;
      }
      location = parentLocation + location;
    }
    try {
      // URL class performs structural decomposition of location for us
      // URI class performs character encoding, but ONLY via multipart constructors
      // Finally, we have a fully qualified and escaped location for future manipulation
      URL url = new URL(location);
      URI uri =
          new URI(
              url.getProtocol(),
              url.getUserInfo(),
              url.getHost(),
              url.getPort(),
              url.getPath(),
              url.getQuery(),
              url.getRef());
      location = uri.toASCIIString();
    } catch (MalformedURLException | URISyntaxException e) {
      throw new RuntimeException(e);
    }
    return location;
  }

  /**
   * Return the parent entry.
   *
   * @return the parent entry
   */
  public Optional<DavEntry> getParent() {
    return Optional.ofNullable(parent);
  }

  /**
   * Return the level
   *
   * @return the level
   */
  int getLevel() {
    return getParent().isPresent() ? getParent().get().getLevel() + 1 : 0;
  }

  /**
   * Return the directory's files.
   *
   * @return This directory's files or an empty array if the file is not a directory or the
   *     directory is empty
   */
  public List<DavEntry> getChildren() {
    return new ArrayList<>(children);
  }

  /**
   * Set the directory's files.
   *
   * @param child a file contained by the directory
   */
  public void addChild(@NotNull final DavEntry child) {
    children.add(child);
  }

  public void removeChild(@NotNull final DavEntry child) {
    children.remove(child);
  }

  /**
   * gets the {@link AsyncFileEntry} from the parent if it exists.
   *
   * @return the entry from the parent or null.
   */
  public DavEntry getFromParent() {
    if (parent != null) {
      if (parent.hasChild(this)) {
        List<DavEntry> children = parent.getChildren();
        return children.get(children.indexOf(this));
      }
    }
    return null;
  }

  private boolean hasChild(DavEntry davEntry) {
    return children.contains(davEntry);
  }

  /**
   * Return a local cache of the file being monitored. This file is invalidated if necessary when
   * refresh() is called.
   *
   * @param sardine
   * @return the file being monitored
   */
  public File getFile(Sardine sardine) throws IOException {
    if (file == null || !file.exists()) {
      Path dav = Files.createTempDirectory("dav");
      File dest =
          new File(dav.toFile(), URLDecoder.decode(FilenameUtils.getName(getLocation()), "UTF-8"));
      try (OutputStream os = new FileOutputStream(dest)) {
        IOUtils.copy(sardine.get(getLocation()), os);
        setFile(dest);
      } catch (IOException e) {
        throw new UncheckedIOException(e);
      }
    }
    return file;
  }

  /**
   * Return the file location.
   *
   * @return the file location
   */
  public String getLocation() {
    return location;
  }

  /**
   * Set the file location.
   *
   * @param location the file location
   */
  public void setLocation(final String location) {
    this.location = location;
  }

  /**
   * Return the last modified time from the last time it was checked.
   *
   * @return the last modified time
   */
  public long getLastModified() {
    return isExists() && lastDav.getModified() != null ? lastDav.getModified().getTime() : 0;
  }

  private long snapGetLastModified() {
    return snapIsExists() && lastDavSnapshot.getModified() != null
        ? lastDavSnapshot.getModified().getTime()
        : 0;
  }

  /**
   * Return the length.
   *
   * @return the length
   */
  public long getLength() {
    return isExists() && !isDirectory() ? lastDav.getContentLength() : 0;
  }

  private long snapGetLength() {
    return snapIsExists() && !snapIsDirectory() ? lastDav.getContentLength() : 0;
  }

  /**
   * Indicate whether the file existed the last time it was checked.
   *
   * @return whether the file existed
   */
  public boolean isExists() {
    return lastDav != null;
  }

  private boolean snapIsExists() {
    return lastDavSnapshot != null;
  }

  /**
   * Indicate whether the file is a directory or not.
   *
   * @return whether the file is a directory or not
   */
  public boolean isDirectory() {
    return isExists() && lastDav.isDirectory();
  }

  private boolean snapIsDirectory() {
    return snapIsExists() && lastDavSnapshot.isDirectory();
  }

  /**
   * If this {@code DavEntry}'s file is cached, delete it. A {@code DavEntry}'s file is cached on
   * the first call to {@link #getFile(Sardine) DavEntry.getFile(Sardine)}.
   */
  public void deleteCacheIfExists() {
    if (file != null) {
      FileUtils.deleteQuietly(file.getParentFile());
    }
  }

  boolean remoteExists(Sardine sardine) {
    try {
      sardine.list(getLocation());
      return true;
    } catch (IOException e) {
      return false;
    }
  }

  public String getETag() {
    return isExists() ? lastDav.getEtag() : "0";
  }

  private String snapGetETag() {
    return snapIsExists() ? lastDavSnapshot.getEtag() : "0";
  }

  void setFile(File file) {
    this.file = file;
  }

  @Override
  public String getName() {
    return location;
  }

  @Override
  public boolean checkNetwork() {
    return false;
  }

  public int compareTo(@NotNull DavEntry o) {
    return location.compareTo(o.getName());
  }

  public void commit() {
    refresh(lastDavSnapshot);
  }

  public boolean hasChanged(DavResource davResource) {

    lastDavSnapshot = davResource;

    // Return if there are changes
    return isExists() != snapIsExists() //
        || getLastModified() != snapGetLastModified() //
        || isDirectory() != snapIsDirectory() //
        || getLength() != snapGetLength() //
        || !Objects.equals(getETag(), snapGetETag());
  }
}
