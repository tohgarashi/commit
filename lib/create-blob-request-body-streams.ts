import * as fs from "fs";
import { Readable, Transform } from "stream";
import { join } from "path";
import * as MultiStream from "multistream";

/**
 * Encodes chunks in a stream to base64
 */
const base64Transformer = new Transform({
  transform(chunk, encoding, callback) {
    this.push(chunk.toString("base64"));
    callback();
  },
});

/**
 * Produces a stream that conforms to the shape expected
 * by the POST /repos/{owner}/{repo}/git/blobs GitHub API
 *
 * For example, streams produced by this class will resolve to a shape like:
 *  {
 *    "encoding": "base64",
 *    "content": "SGFsZiBtZWFzdXJlcyBhcmUgYXMgYmFkIGFzIG5vdGhpbmcgYXQgYWxsLg=="
 *  }
 *
 * See: https://docs.github.com/rest/reference/git#create-a-blob
 */
export class CreateBlobRequestBodyStream extends MultiStream {
  readonly path: string;

  constructor(path: string, opts = {}) {
    // Produces the JSON body as a stream, so that we don't have to read (
    // potentially very large) files into memory
    super(
      [
        Readable.from('{"encoding":"base64","content":"'),
        fs.createReadStream(path).pipe(base64Transformer),
        Readable.from('"}'),
      ],
      opts
    );

    this.path = path;
  }
}

export interface Options {
  /** Optional. Default base dir to use when expanding a set of paths. */
  baseDir?: string;
}

export default function getCreateBlobRequestBodyStreams(
  paths: string,
  options: Options = {}
): Array<CreateBlobRequestBodyStream> {
  const { baseDir } = options;
  return paths
    .trim()
    .split("\n")
    .map((path) => join(baseDir, path))
    .filter((path) => fs.existsSync(path))
    .map((path) => new CreateBlobRequestBodyStream(path));
}
