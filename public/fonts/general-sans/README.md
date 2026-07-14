# General Sans (display font)

This directory is the drop-in slot for General Sans. The build environment
cannot reach Fontshare (network policy), so the files are not committed yet.

To install:

1. Download General Sans from https://www.fontshare.com/fonts/general-sans
   (free for commercial use under the ITF Free Font License).
2. Copy `GeneralSans-Variable.woff2` from the zip's `WEB/fonts/` folder into
   this directory.

The `@font-face` rule in `src/app/globals.css` picks it up automatically;
until then headings render in self-hosted Inter (the documented fallback).
