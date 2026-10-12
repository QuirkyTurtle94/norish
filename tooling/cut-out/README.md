# Cut-out tool

Makes the flat background of a picture see-through: a logo on white, an app
icon on its brand colour, a drawing on a plain backdrop. Writes a PNG (or a
lossless WebP) at the picture's full size beside it, and never changes the
picture itself.

```sh
# Artwork of any colours: logo.jpg becomes logo.cut-out.png
pnpm --filter @norish/cut-out-tool cut-out path/to/logo.jpg

# A mark of one colour, painted its exact brand colour
pnpm --filter @norish/cut-out-tool cut-out icon.png icon-mark.png --mark --color "#FFFEF7"
```

Two ways, for two kinds of picture:

- **Artwork** (the default) floods the background away from the border, so
  a patch of its colour inside the artwork (the middle of an O, a white
  highlight) stays. The flood leaves a line of half-mixed pixels along every
  edge, which shows as a pale outline on a dark page; the tool trims that
  line and feathers the new edge, at the cost of one pixel of the artwork.
- **`--mark`** is for a mark of one colour: a logo, an icon, lettering. It
  gives the cleanest edges: each pixel becomes as opaque as it is mark, and
  every pixel is painted one colour, so nothing of the old background is
  left in an edge. That colour is the commonest one apart from the
  background, unless `--color` names another. A hole in the mark (the inside
  of an O) becomes see-through too.

The background is the colour of the picture's border, so at least 90% of the
border has to be one colour. `--tolerance <n>` (32 by default, a distance in
RGB) is how far a pixel may stray from it and still be background; raise it
for a noisy JPEG. A picture that already has transparency is refused. A photo,
or anything else whose background is not one colour, needs a matting tool
instead.

The cutting itself is `@norish/shared-server/media/cut-out`, whose flood
Ingredient Icons use to cut a drawing free.
