export interface TrackerVersion {
  version: string;
  /** Public path the portal serves this version at, e.g. `/p/1.0.0/px.js`. */
  scriptPath: string;
  /** Path the script posts events to (proxied to Umami's /api/send). */
  collectPath: string;
  /** Committed file, relative to the package root. */
  file: string;
  /** Subresource Integrity value, `sha384-…`. */
  sha384: string;
  upstream: {
    project: string;
    version: string;
    image: string;
    file: string;
    sha256: string;
  };
}

export interface TrackerManifest {
  current: string;
  versions: TrackerVersion[];
}
