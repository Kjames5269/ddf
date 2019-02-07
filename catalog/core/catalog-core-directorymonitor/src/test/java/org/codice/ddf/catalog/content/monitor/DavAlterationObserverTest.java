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

import static org.mockito.Matchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.only;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.github.sardine.DavResource;
import com.github.sardine.Sardine;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import org.apache.camel.spi.Synchronization;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import org.mockito.invocation.InvocationOnMock;

@RunWith(JUnit4.class)
public class DavAlterationObserverTest {
  private DavEntry parent;

  private DavResource mockParent;

  private DavResource mockChild1;

  private DavResource mockChild1Changed;

  private DavResource mockChild3;

  private DavResource mockChild3Changed;

  private Sardine mockSardine;

  private DavAlterationObserver observer;

  private EntryAlterationListener mockListener;

  private Consumer<Runnable> doTestWrapper = Runnable::run;

  private final AtomicInteger timesToFail = new AtomicInteger(0);

  private int failures = 0;

  private void doTest(Synchronization cb) {
    synchronized (timesToFail) {
      if (timesToFail.intValue() != 0) {
        timesToFail.decrementAndGet();
        failures++;
        cb.onFailure(null);
      } else {
        cb.onComplete(null);
      }
    }
  }

  private DavEntry child1;
  private DavEntry child2;

  @Before
  public void setup() throws IOException {
    parent = new DavEntry("http://test");
    child1 = parent.newChildInstance("child1");
    child2 = parent.newChildInstance("child2");

    mockSardine = mock(Sardine.class);
    mockParent = mock(DavResource.class);
    mockChild1 = mock(DavResource.class);
    mockChild3 = mock(DavResource.class);
    mockChild1Changed = mock(DavResource.class);
    mockChild3Changed = mock(DavResource.class);

    initMock(mockParent, "/test", true, 0L, "E/0001");
    initMock(mockChild1, "/child1", false, 42L, "E/0002");
    initMock(mockChild3, "/child3", false, 43L, "E/0003");
    initMock(mockChild1Changed, "/child1", false, 43L, "E/0003");
    initMock(mockChild3Changed, "/child3", false, 43L, "E/0003");

    doReturn(Arrays.asList(mockParent, mockChild1, mockChild3))
        .when(mockSardine)
        .list(parent.getLocation());
    doReturn(Collections.singletonList(mockChild1)).when(mockSardine).list(child1.getLocation());
    doReturn(Collections.singletonList(mockChild3)).when(mockSardine).list(child2.getLocation());

    observer = new DavAlterationObserver(parent);
    mockListener = mock(EntryAlterationListener.class);
    observer.initialize(mockSardine);
    observer.addListener(mockListener);

    init();
  }

  private void initMock(DavResource toMock, String name, boolean isDir, long length, String tag) {
    doReturn(name).when(toMock).getName();
    doReturn(isDir).when(toMock).isDirectory();
    doReturn(new Date()).when(toMock).getModified();
    doReturn(length).when(toMock).getContentLength();
    doReturn(tag).when(toMock).getEtag();
  }

  private void init() {
    doAnswer(this::mockitoDoTest)
        .when(mockListener)
        .onFileCreate(any(), any(Synchronization.class));

    doAnswer(this::mockitoDoTest)
        .when(mockListener)
        .onFileChange(any(), any(Synchronization.class));

    doAnswer(this::mockitoDoTest)
        .when(mockListener)
        .onFileDelete(any(), any(Synchronization.class));

    doAnswer(this::mockitoDoTest)
        .when(mockListener)
        .onDirectoryCreate(any(), any(Synchronization.class));

    doAnswer(this::mockitoDoTest)
        .when(mockListener)
        .onDirectoryChange(any(), any(Synchronization.class));

    doAnswer(this::mockitoDoTest)
        .when(mockListener)
        .onDirectoryDelete(any(), any(Synchronization.class));

    timesToFail.set(0);
    failures = 0;
  }

  private Object mockitoDoTest(InvocationOnMock e) {
    Object[] args = e.getArguments();
    doTestWrapper.accept(() -> doTest((Synchronization) args[1]));
    return null;
  }

  @Test(expected = IllegalArgumentException.class)
  public void testNullRoot() {
    new DavAlterationObserver(null);
  }

  @Test
  public void testInit() {
    observer.checkAndNotify(mockSardine);
    verifyNoMoreInteractions(mockListener);
  }

  @Test
  public void testInsertedCreate() throws IOException {
    DavResource mockChild2 = mock(DavResource.class);
    DavEntry child2 = parent.newChildInstance("/child2");
    initMock(mockChild2, "/child2", false, 17, "E/0004");
    doReturn(Arrays.asList(mockParent, mockChild1, mockChild2, mockChild3))
        .when(mockSardine)
        .list(parent.getLocation());
    doReturn(Collections.singletonList(mockChild2)).when(mockSardine).list(child2.getLocation());

    observer.checkAndNotify(mockSardine);
    verify(mockListener, only()).onFileCreate(any(), any());
  }

  @Test
  public void testTrailingCreate() throws IOException {
    DavResource mockChild4 = mock(DavResource.class);
    DavEntry child4 = parent.newChildInstance("/child4");
    initMock(mockChild4, "/child4", false, 17L, "E/0005");
    doReturn(Arrays.asList(mockParent, mockChild1, mockChild4, mockChild3))
        .when(mockSardine)
        .list(parent.getLocation());
    doReturn(Collections.singletonList(mockChild4)).when(mockSardine).list(child4.getLocation());

    observer.checkAndNotify(mockSardine);
    verify(mockListener, only()).onFileCreate(any(), any());
  }

  @Test
  public void testLeadingCreate() throws IOException {
    DavResource mockChild0 = mock(DavResource.class);
    DavEntry child0 = parent.newChildInstance("/child0");
    initMock(mockChild0, "/child0", false, 12345L, "E/0011");
    doReturn(Arrays.asList(mockParent, mockChild1, mockChild0, mockChild3))
        .when(mockSardine)
        .list(parent.getLocation());
    doReturn(Collections.singletonList(mockChild0)).when(mockSardine).list(child0.getLocation());

    observer.checkAndNotify(mockSardine);
    verify(mockListener, only()).onFileCreate(any(), any());
  }

  @Test
  public void testModify() throws IOException {
    doReturn(Arrays.asList(mockParent, mockChild1Changed, mockChild3))
        .when(mockSardine)
        .list(parent.getLocation());
    doReturn(Collections.singletonList(mockChild1Changed))
        .when(mockSardine)
        .list(child1.getLocation());
    doReturn("E/00006").when(mockChild1Changed).getEtag();

    observer.checkAndNotify(mockSardine);
    verify(mockListener, only()).onFileChange(any(), any());
  }

  @Test
  public void testModifyWithFailure() throws IOException {
    timesToFail.set(1);
    doReturn(Arrays.asList(mockParent, mockChild1Changed, mockChild3))
        .when(mockSardine)
        .list(parent.getLocation());
    doReturn(Collections.singletonList(mockChild1Changed))
        .when(mockSardine)
        .list(child1.getLocation());
    doReturn("E/00006").when(mockChild1Changed).getEtag();

    observer.checkAndNotify(mockSardine);
    verify(mockListener, times(failures)).onFileChange(any(), any());
    observer.checkAndNotify(mockSardine);
    verify(mockListener, times(failures + 1)).onFileChange(any(), any());
  }

  @Test
  public void testRename() {
    doReturn("/child7").when(mockChild1).getName();
    observer.checkAndNotify(mockSardine);
    verify(mockListener, times(1)).onFileCreate(any(), any());
    verify(mockListener, times(1)).onFileDelete(any(), any());
    verifyNoMoreInteractions(mockListener);
  }

  @Test
  public void testDelete() throws IOException {
    doReturn(Arrays.asList(mockParent, mockChild3)).when(mockSardine).list(parent.getLocation());
    observer.checkAndNotify(mockSardine);
    verify(mockListener, only()).onFileDelete(any(), any());
    verifyNoMoreInteractions(mockListener);

    //  If there is an error hitting Sardine, then we assume the network went down and do nothing.
    doThrow(new IOException()).when(mockSardine).list(parent.getLocation());
    observer.checkAndNotify(mockSardine);
  }

  @Test
  public void testDeleteWithFailure() throws IOException {
    timesToFail.set(1);
    doReturn(Arrays.asList(mockParent, mockChild3)).when(mockSardine).list(parent.getLocation());
    observer.checkAndNotify(mockSardine);
    verify(mockListener, only()).onFileDelete(any(), any());
    observer.checkAndNotify(mockSardine);
    verify(mockListener, times(failures + 1)).onFileDelete(any(), any());

    verifyNoMoreInteractions(mockListener);

    //  If there is an error hitting Sardine, then we assume the network went down and do nothing.
    doThrow(new IOException()).when(mockSardine).list(parent.getLocation());
    observer.checkAndNotify(mockSardine);
  }

  @Test
  public void testDirectory() throws IOException {
    DavEntry dir = parent.newChildInstance("dir");
    DavResource mockDir = mock(DavResource.class);
    initMock(mockDir, "/dir", true, 0L, "E/0008");

    DavResource mockDirChanged = mock(DavResource.class);
    initMock(mockDirChanged, "/dir", true, 0L, "E/0009");

    doReturn(Arrays.asList(mockParent, mockChild1, mockChild3, mockDir))
        .when(mockSardine)
        .list(parent.getLocation());
    observer.checkAndNotify(mockSardine);
    verify(mockListener, times(1)).onDirectoryCreate(any(), any());

    doReturn(Arrays.asList(mockParent, mockChild1, mockChild3, mockDirChanged))
        .when(mockSardine)
        .list(parent.getLocation());
    doReturn(Collections.singletonList(mockDirChanged)).when(mockSardine).list(dir.getLocation());

    observer.checkAndNotify(mockSardine);
    verify(mockListener, times(1)).onDirectoryChange(any(), any());

    doReturn(Arrays.asList(mockParent, mockChild1, mockChild3))
        .when(mockSardine)
        .list(parent.getLocation());
    observer.checkAndNotify(mockSardine);
    verify(mockListener, times(1)).onDirectoryDelete(any(), any());
  }
}
