"use strict";
/* eslint-disable no-async-promise-executor */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rest = exports.Endpoints = void 0;
const undici_1 = require("undici");
class Endpoints {
    static LAVALINK_API_VERSION = 3;
    static SESSIONS = (sessionId) => `/sessions/${sessionId}`;
    //PLAYER
    static PLAYER = (sessionId, guildId) => `/sessions/${sessionId}/players/${guildId}`;
    static LOAD_TRACKS = (identifier) => `/loadtracks?identifier=${encodeURIComponent(identifier)}`;
    static DECODE_TRACKS = () => "/decodetracks";
    static DECODE_TRACK = () => "/decodetrack";
    //Route planner
    static ROUTE_PLANNER_STATUS = () => "/routeplanner/status";
    static ROUTE_PLANNER_FREE_ADDR = () => "/routeplanner/free";
    static ROUTE_PLANNER_FREE_ALL = () => "/routeplanner/free/all";
    //VERSION
    static VERSION = () => "/version";
    static VERSIONS = () => "/versions";
    static INFO = () => "/info";
}
exports.Endpoints = Endpoints;
class Rest {
    node;
    baseUrl;
    sessionId;
    set sessionIdSet(sessionId) {
        this.sessionId = sessionId;
    }
    constructor(node) {
        this.node = node;
        this.baseUrl = `http${node.options.secure ? "s" : ""}://${node.options.host}:${node.options.port}`;
        if (node.options.rest) {
            this.baseUrl += `/v${Endpoints.LAVALINK_API_VERSION}`;
        }
    }
    async decodeTrack(encodedTrack) {
        return this.request({
            method: "GET",
            path: Endpoints.DECODE_TRACK() +
                `?encodedTrack=${encodeURIComponent(encodedTrack)}`,
        });
    }
    async decodeTracks(encodedTracks) {
        return this.request({
            method: "POST",
            path: Endpoints.DECODE_TRACKS(),
            json: encodedTracks,
        });
    }
    async getRoutePlannerStatus() {
        return this.request({
            method: "GET",
            path: Endpoints.ROUTE_PLANNER_STATUS(),
        });
    }
    async freeRoutePlannerAddress(address) {
        await this.request({
            method: "POST",
            path: Endpoints.ROUTE_PLANNER_FREE_ADDR(),
            json: {
                address,
            },
        });
    }
    async freeAllRoutePlannerAddresses() {
        await this.request({
            method: "POST",
            path: Endpoints.ROUTE_PLANNER_FREE_ALL(),
        });
    }
    async loadTracks(identifier) {
        return this.request({
            method: "GET",
            path: Endpoints.LOAD_TRACKS(identifier),
        });
    }
    async updateSession(resumeKey, timeout) {
        await this.request({
            method: "PATCH",
            path: Endpoints.SESSIONS(this.sessionId),
            json: {
                resumeKey,
                timeout,
            },
        });
    }
    async destroyPlayer(guildId) {
        await this.request({
            method: "DELETE",
            path: Endpoints.PLAYER(this.sessionId, guildId),
        });
    }
    async updatePlayer(guildId, options) {
        let path = Endpoints.PLAYER(this.sessionId, guildId);
        if (options.noReplace) {
            path += "?noReplace=true";
        }
        delete options.noReplace;
        await this.request({
            method: "PATCH",
            path,
            json: options,
        });
    }
    async info() {
        return this.request({
            method: "GET",
            path: Endpoints.INFO(),
        });
    }
    async version() {
        return this.request({
            method: "GET",
            path: Endpoints.VERSION(),
        });
    }
    async request(options) {
        const { method, path, json } = options;
        const headers = {
            ...options.headers,
            authorization: this.node.options.password ?? "",
        };
        let body = null;
        if (json) {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(json);
        }
        const res = await (0, undici_1.fetch)(`${this.baseUrl}${path}`, {
            method,
            headers,
            body,
        });
        if (res.status >= 400) {
            if (res.headers.get("content-type") === "application/json") {
                const error = (await res.json());
                throw new Error(`Lavalink request failed with status code ${res.status}. Path: ${error.path}. ERROR: ${error.error}: ${error.message}`);
            }
            throw new Error(`Request failed with status code ${res.status}`);
        }
        let resBody;
        if (res.status === 204) {
            resBody = null;
        }
        else if (res.headers.get("content-type") === "application/json") {
            resBody = await res.json();
        }
        else {
            resBody = Buffer.from(await res.arrayBuffer());
        }
        return resBody;
    }
}
exports.Rest = Rest;
