const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Parent folder has another package-lock.json; without this Next traces
  // modules from C:\Users\shubh and Prisma fails at runtime.
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  transpilePackages: ["@turf/area", "@turf/helpers", "@turf/length"],
};

module.exports = nextConfig

