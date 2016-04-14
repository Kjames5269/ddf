/**
 * Copyright (c) Codice Foundation
 * <p>
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or any later version.
 * <p>
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details. A copy of the GNU Lesser General Public License
 * is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 */
package ddf.catalog.plugin.groomer.metacard;

import java.io.Serializable;
import java.net.URI;
import java.util.Collections;
import java.util.Date;
import java.util.Map.Entry;
import java.util.UUID;
import java.util.regex.Pattern;

import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import ddf.catalog.content.data.ContentItem;
import ddf.catalog.data.Metacard;
import ddf.catalog.data.impl.AttributeImpl;
import ddf.catalog.operation.CreateRequest;
import ddf.catalog.operation.UpdateRequest;
import ddf.catalog.plugin.groomer.AbstractMetacardGroomerPlugin;

/**
 * Applies general Create and Update grooming rules such as populating the {@link Metacard#ID},
 * {@link Metacard#MODIFIED}, and {@link Metacard#CREATED} fields.
 */
public class StandardMetacardGroomerPlugin extends AbstractMetacardGroomerPlugin {

    private static final Logger LOGGER =
            LoggerFactory.getLogger(StandardMetacardGroomerPlugin.class);

    private Pattern hexPattern = Pattern.compile("^[0-9A-Fa-f]+$");

    protected void applyCreatedOperationRules(CreateRequest createRequest, Metacard aMetacard,
            Date now) {
        LOGGER.debug("Applying standard rules on CreateRequest");
        if (!isCatalogResourceUri(aMetacard.getResourceURI())
                || !isCorrectFormatId(aMetacard.getId())) {
            aMetacard.setAttribute(new AttributeImpl(Metacard.ID,
                    UUID.randomUUID()
                            .toString()
                            .replaceAll("-", "")));
        }

        if (aMetacard.getCreatedDate() == null) {
            aMetacard.setAttribute(new AttributeImpl(Metacard.CREATED, now));
        }

        if (aMetacard.getModifiedDate() == null) {
            aMetacard.setAttribute(new AttributeImpl(Metacard.MODIFIED, now));
        }

        if (aMetacard.getEffectiveDate() == null) {
            aMetacard.setAttribute(new AttributeImpl(Metacard.EFFECTIVE, now));
        }

        if (CollectionUtils.isEmpty(aMetacard.getTags())) {
            aMetacard.setAttribute(new AttributeImpl(Metacard.TAGS,
                    Collections.singletonList(Metacard.DEFAULT_TAG)));
        }
    }

    private boolean isCatalogResourceUri(URI uri) {
        return uri != null && ContentItem.CONTENT_SCHEME.equals(uri.getScheme());
    }

    private boolean isCorrectFormatId(String id) {
        return !StringUtils.isEmpty(id) && id.length() == 32 && hexPattern.matcher(id)
                .matches();
    }

    protected void applyUpdateOperationRules(UpdateRequest updateRequest,
            Entry<Serializable, Metacard> anUpdate, Metacard aMetacard, Date now) {

        if (UpdateRequest.UPDATE_BY_ID.equals(updateRequest.getAttributeName())
                && !anUpdate.getKey()
                .toString()
                .equals(aMetacard.getId())) {

            LOGGER.info(
                    "{} in metacard must match the Update {}, overwriting metacard {} [{}] with the update identifier [{}]",
                    Metacard.ID,
                    Metacard.ID,
                    Metacard.ID,
                    aMetacard.getId(),
                    anUpdate.getKey());
            aMetacard.setAttribute(new AttributeImpl(Metacard.ID, anUpdate.getKey()));

        }

        if (aMetacard.getCreatedDate() == null) {
            LOGGER.info(
                    "{} date should match the original metacard. Changing date to current timestamp so it is at least not null.",
                    Metacard.CREATED);
            aMetacard.setAttribute(new AttributeImpl(Metacard.CREATED, now));
        }

        if (aMetacard.getModifiedDate() == null) {
            aMetacard.setAttribute(new AttributeImpl(Metacard.MODIFIED, now));
        }

        if (aMetacard.getEffectiveDate() == null) {
            aMetacard.setAttribute(new AttributeImpl(Metacard.EFFECTIVE, now));
        }

        if (CollectionUtils.isEmpty(aMetacard.getTags())) {
            aMetacard.setAttribute(new AttributeImpl(Metacard.TAGS,
                    Collections.singletonList(Metacard.DEFAULT_TAG)));
        }

    }

}
