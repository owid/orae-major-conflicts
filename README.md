## Prerequisites

To generate the files yourself, you need ImageMagick, Tesseract 4.0, Node.js and ScanTailor.

### MacOS

You can use [brew](https://brew.sh/) to install all but one of them:

```sh
brew install imagemagick tesseract node
```

Then [download ScanTailor](https://code.google.com/archive/p/scantailor-osx/).

## Process

1. Convert the PDF into images:

```sh
convert -density 300 1-pdf/orae_merged.pdf 2-images/p%03d.png
```

(After going through this, TIFF seems like it would've been the better option here, but it's a bit of work to change now.)

2. Open all the images in ScanTailor to crop, deskew and dewarp them, then export them to `3-clean-images/`. Doing this [improves the results](https://github.com/tesseract-ocr/tesseract/wiki/ImproveQuality) when doing OCR.

3. Use `tessaract` to extract the text from the images:

```sh
(cd 3-clean-images; for file in *.tif; do echo $file; tesseract --psm 4 -l eng $file 4-ocr/$file; done)
```

4. Use the `split-events.js` script to extract the individual events from each page. (Note: this script is very specific to tesseract 4.0 with the default training data, you need to tweak it if you're working with something else.)

```sh
(cd 4-ocr; for file in *.txt; do echo $file; ../split-events.js 4-ocr/$file 5-ocr-split/$file; done)
```

5. Extract structured data from each event file.

```
// TODO
```