import {expand} from 'jsonld';
import Config from "./Config/Config";
import failOnHttpError from "../utils/httpUtils";
import {toJsonLd} from "../utils/metadataUtils";
import Vocabulary from "./Vocabulary";

class MetadataAPI {
    static getParams = {
        method: 'GET',
        headers: new Headers({Accept: 'application/ld+json'}),
        credentials: 'same-origin'
    };

    get(params) {
        const query = Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
        return fetch(`${Config.get().urls.metadata.statements}?labels&${query}`, MetadataAPI.getParams)
            .then(failOnHttpError("Failure when retrieving metadata"))
            .then(response => response.json())
            .then(expand);
    }

    updateEntity(subject, properties) {
        if (!subject || !properties) {
            return Promise.reject(Error("No subject or properties given"));
        }

        const jsonLd = Object.keys(properties).map(p => toJsonLd(subject, p, properties[p]));

        console.log({jsonLd});
        

        return fetch(Config.get().urls.metadata.statements, {
            method: 'PATCH',
            headers: new Headers({'Content-type': 'application/ld+json'}),
            credentials: 'same-origin',
            body: JSON.stringify(jsonLd)
        }).then(failOnHttpError("Failure when updating metadata"));
    }

    /**
     * Retrieves the vocabulary (user and system) and instantiates a Vocabulary object with it
     * @returns {Promise<Vocabulary | never>}
     */
    getVocabulary() {
        // TODO: store the user and system vocabulary separately to allow
        //       easy vocabulary editing for the user vocabulary
        return Config.waitFor()
            .then(() => Promise.all([
                fetch(Config.get().urls.vocabulary.user, MetadataAPI.getParams)
                    .then(failOnHttpError("Failure when retrieving the user vocabulary"))
                    .then(response => response.json())
                    .then(expand),
                fetch(Config.get().urls.vocabulary.system, MetadataAPI.getParams)
                    .then(failOnHttpError("Failure when retrieving the system vocabulary"))
                    .then(response => response.json())
                    .then(expand)
            ]))
            .then(([userVocabulary, systemVocabulary]) => [...userVocabulary, ...systemVocabulary])
            .then(expandedVocabulary => new Vocabulary(expandedVocabulary));
    }

    /**
     * Returns all entities in the metadata store for the given type
     *
     * More specifically this method returns all entities x for which a
     * triple exist <x> <@type> <type> exists.
     *
     * @param type  URI of the Class that the entities should be a type of
     * @returns Promise<jsonld> A promise with an expanded version of the JSON-LD structure, describing the entities.
     *                          The entities will have an ID, type and optionally an rdfs:label
     */
    getEntitiesByType(type) {
        return fetch(Config.get().urls.metadata.entities + "?type=" + encodeURIComponent(type), MetadataAPI.getParams)
            .then(failOnHttpError("Failure when retrieving entities"))
            .then(response => response.json())
            .then(expand);
    }

    /**
     * Returns all Fairspace entities in the metadata store for the given type
     *
     * @returns Promise<jsonld> A promise with an expanded version of the JSON-LD structure, describing the entities.
     *                          The entities will have an ID, type and optionally an rdfs:label
     */
    getAllEntities() {
        return fetch(Config.get().urls.metadata.entities, MetadataAPI.getParams)
            .then(failOnHttpError("Failure when retrieving entities"))
            .then(response => response.json())
            .then(expand);
    }

    getSubjectByPath(path) {
        return fetch(Config.get().urls.metadata.pid + '?path=' + encodeURIComponent(path), {
            method: 'GET',
            headers: new Headers({Accept: 'text/plain'}),
            credentials: 'same-origin'
        })
            .then(failOnHttpError("Failure when retrieving metadata"))
            .then(response => response.text());
    }
}

export default new MetadataAPI();
