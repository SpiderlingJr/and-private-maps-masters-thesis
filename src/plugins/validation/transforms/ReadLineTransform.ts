import { Transform, TransformCallback, TransformOptions } from "stream";

/**
 * The ReadlineTransform is reading String or Buffer content from a Readable stream
 * and writing each line which ends without line break as object
 *
 * @param {RegExp} opts.breakMatcher - line break matcher for str.split() (default: /\r?\n/)
 * @param {Boolean} opts.ignoreEndOfBreak - if content ends with line break, ignore last empty line (default: true)
 * @param {Boolean} opts.skipEmpty - if line is empty string, skip it (default: false)
 */
export class ReadlineTransform extends Transform {
  _brRe;
  _ignoreEndOfBreak;
  _skipEmpty;
  _buf: string | null;

  constructor(options: any = {}) {
    const opts = options || {};
    opts.objectMode = true;
    super(opts);
    this._brRe = opts.breakMatcher || /\r?\n/;
    this._ignoreEndOfBreak =
      "ignoreEndOfBreak" in opts ? Boolean(opts.ignoreEndOfBreak) : true;
    this._skipEmpty = Boolean(opts.skipEmpty);
    this._buf = "";
  }
  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    let str: string;

    if (Buffer.isBuffer(chunk) || encoding.valueOf() === "buffer") {
      str = chunk.toString("utf8");
    } else {
      str = chunk;
    }

    try {
      if (this._buf !== null) {
        this._buf += str;
      } else {
        this._buf = str;
      }
      const lines = this._buf.split(this._brRe);

      const lastIndex = lines.length - 1;
      for (let i = 0; i < lastIndex; i++) {
        this._writeItem(lines[i] + "\n");
      }

      const lastLine = lines[lastIndex];
      if (lastLine.length) {
        this._buf = lastLine;
      } else if (!this._ignoreEndOfBreak) {
        this._buf = "";
      } else {
        this._buf = null;
      }
      callback();
    } catch (err: any) {
      callback(err); // invalid data type;
    }
  }
  _flush(callback: any) {
    if (this._buf !== null) {
      this._writeItem(this._buf);
      this._buf = null;
    }
    callback();
  }

  _writeItem(line: string) {
    if (line.length > 0 || !this._skipEmpty) {
      this.push(line);
    }
  }
}
