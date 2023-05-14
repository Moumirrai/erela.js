/* eslint-disable no-async-promise-executor */

//Added by Moumirrai

import { Node } from "./Node";
import { fetch } from "undici";
import { TrackData, LoadType } from "./Utils";
import { PlaylistInfo } from "./Manager";

export class Endpoints {
  static LAVALINK_API_VERSION = 3;
  static SESSIONS = (sessionId: string) => `/sessions/${sessionId}`;
  //PLAYER
  static PLAYER = (sessionId: string, guildId: string) =>
    `/sessions/${sessionId}/players/${guildId}`;
  static LOAD_TRACKS = (identifier: string) =>
    `/loadtracks?identifier=${encodeURIComponent(identifier)}`;
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

export class Rest {
  private readonly baseUrl: string;
  sessionId: string;

  set sessionIdSet(sessionId: string) {
    this.sessionId = sessionId;
  }

  constructor(private readonly node: Node) {
    this.baseUrl = `http${node.options.secure ? "s" : ""}://${
      node.options.host
    }:${node.options.port}`;

    if (node.options.rest) {
      this.baseUrl += `/v${Endpoints.LAVALINK_API_VERSION}`;
    }
  }

  public async decodeTrack(encodedTrack: string): Promise<TrackData> {
    return this.request({
      method: "GET",
      path:
        Endpoints.DECODE_TRACK() +
        `?encodedTrack=${encodeURIComponent(encodedTrack)}`,
    });
  }

  public async decodeTracks(encodedTracks: string[]): Promise<TrackData[]> {
    return this.request({
      method: "POST",
      path: Endpoints.DECODE_TRACKS(),
      json: encodedTracks,
    });
  }

  public async getRoutePlannerStatus(): Promise<RoutePlannerStatus> {
    return this.request({
      method: "GET",
      path: Endpoints.ROUTE_PLANNER_STATUS(),
    });
  }

  public async freeRoutePlannerAddress(address: string) {
    await this.request({
      method: "POST",
      path: Endpoints.ROUTE_PLANNER_FREE_ADDR(),
      json: {
        address,
      },
    });
  }
  public async freeAllRoutePlannerAddresses() {
    await this.request({
      method: "POST",
      path: Endpoints.ROUTE_PLANNER_FREE_ALL(),
    });
  }

  public async loadTracks(identifier: string): Promise<LoadTracksResult> {
    return this.request({
      method: "GET",
      path: Endpoints.LOAD_TRACKS(identifier),
    });
  }

  public async updateSession(resumeKey: string, timeout?: number) {
    await this.request({
      method: "PATCH",
      path: Endpoints.SESSIONS(this.sessionId),
      json: {
        resumeKey,
        timeout,
      },
    });
  }

  public async destroyPlayer(guildId: string) {
    await this.request({
      method: "DELETE",
      path: Endpoints.PLAYER(this.sessionId, guildId),
    });
  }

  public async updatePlayer(guildId: string, options: UpdatePlayerOptions) {
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

  public async info(): Promise<Info> {
    return this.request({
      method: "GET",
      path: Endpoints.INFO(),
    });
  }

  public async version(): Promise<string> {
    return this.request({
      method: "GET",
      path: Endpoints.VERSION(),
    });
  }

  public async request<T = unknown>(options: RequestOptions): Promise<T> {
    const { method, path, json } = options;

    const headers: Record<string, string> = {
      ...options.headers,
      authorization: this.node.options.password ?? "",
    };
    let body: string | null = null;

    if (json) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(json);
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body,
    });

    if (res.status >= 400) {
      if (res.headers.get("content-type") === "application/json") {
        const error = (await res.json()) as LavalinkRESTError;

        throw new Error(
          `Lavalink request failed with status code ${res.status}. Path: ${error.path}. ERROR: ${error.error}: ${error.message}`
        );
      }
      throw new Error(`Request failed with status code ${res.status}`);
    }

    let resBody;

    if (res.status === 204) {
      resBody = null;
    } else if (res.headers.get("content-type") === "application/json") {
      resBody = await res.json();
    } else {
      resBody = Buffer.from(await res.arrayBuffer());
    }

    return resBody as T;
  }
}

export interface LavalinkRESTError {
  timestamp: number;
  status: number;
  error: string;
  trace?: string;
  message: string;
  path: string;
}

export interface RequestOptions {
  path: string;
  method: import("undici").Dispatcher.HttpMethod;
  json?: unknown;
  headers?: Record<string, string>;
}

export interface RoutePlannerStatus {
  class: string | null;
  details: RoutePlannerDetails | null;
}

export interface RoutePlannerDetails {
  ipBlock: {
    type: string;
    size: string;
  };
  failingAddresses: Array<{
    address: string;
    failingTimestamp: number;
    failingTime: string;
  }>;
  blockIndex?: string;
  currentAddressIndex?: string;
}

interface LoadResultBase {
  loadType: LoadType;
  playlistInfo: PlaylistInfo;
  exception?: LoadException;
}

interface LoadException {
  message: string;
  severity: "COMMON" | "SUSPIOUS" | "FAULT";
}

export interface LoadTracksResult extends LoadResultBase {
  tracks: TrackData[];
}

export type Info = {
  version: {
    semver: string;
    major: number;
    minor: number;
    patch: number;
    preRelease: string | null;
  };
  buildTime: number;
  git: {
    branch: string;
    commit: string;
    commitTime: number;
  };
  jvm: string;
  lavaplayer: string;
  sourceManagers: string[];
  filters: string[];
  plugins: Array<{
    name: string;
    version: string;
  }>;
};

export type UpdatePlayerOptions = {
  encodedTrack?: string | null;
  // identifier?: string;
  position?: number;
  endTime?: number;
  volume?: number;
  paused?: boolean;
  filters?: FilterOptions;
  voice?: {
    sessionId: string;
    token: string;
    endpoint: string;
  };
  noReplace?: boolean;
};

export type FilterOptions = {
  //TODO: add all filters
  //channelMix?: ChannelMixOptions;
  //distortion?: DistortionOptions;

  /**
   * 15 bands [0-14]
   * 25 Hz, 40 Hz, 63 Hz, 100 Hz, 160 Hz, 250 Hz, 400 Hz, 630 Hz, 1 kHz, 1.6 kHz, 2.5 kHz, 4 kHz, 6.3 kHz, 10 kHz, 16 kHz
   */

  /*
  equalizer?: number[];

  karaoke?: KaraokeOptions;
  lowPass?: LowPassOptions;
  rotation?: RotationOptions;
  timescale?: TimescaleOptions;
  tremolo?: TremoloOptions;
  vibrato?: VibratoOptions;
  */
  volume?: number;

  //[key: string]: unknown;
}
