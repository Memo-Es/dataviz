// The GL3D-only build (plotly.js-gl3d-dist-min) ships no types of its own and @types/plotly.js
// only declares the "plotly.js" module path -- it's the same API surface (go.Surface,
// go.Scatter3d, newPlot/react/restyle...), just a smaller runtime bundle, so re-export the
// full types under this module's own specifier.
declare module "plotly.js-gl3d-dist-min" {
  export * from "plotly.js";
}
