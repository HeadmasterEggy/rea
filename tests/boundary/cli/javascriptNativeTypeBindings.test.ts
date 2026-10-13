import { expect } from "vitest";
import { z } from "zod";

import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import { writeFixtureFiles } from "../../support/javascriptApplicationFixture.js";
import { cliTest } from "../../support/cli/cliFixture.js";
import { javascriptApplicationAnalysisResultSchema } from "../../../src/domain/javascript/javascriptApplicationAnalysis.js";

cliTest(
  "excludes erased TypeScript names from native addon requests",
  async ({ cli }) => {
    const root = await createTestTempDirectory("rea-native-type-bindings-");
    await writeFixtureFiles(root, {
      "package.json": JSON.stringify({ main: "main.ts" }),
      "main.ts": `
        import type { NativeThing } from "./addon.node";
        export type { Extra } from "./addon.node";
        import { type OtherThing, load } from "./addon.node";
        load();
      `,
      "addon.node": "",
    });
    const output = await cli.run({
      arguments: ["analyze-javascript-application", root, "--json"],
    });
    expect(output.exitCode, output.stderr).toBe(0);
    const { normalized_result: result } = z
      .object({
        normalized_result: javascriptApplicationAnalysisResultSchema,
      })
      .parse(output.json);
    const nativeExports = result.graph.nodes.filter(
      (node) => node.kind === "native-export",
    );
    expect(result.summary).toMatchObject({
      native_addon_bindings: 1,
      resolved_native_addon_bindings: 1,
    });
    expect(nativeExports).toHaveLength(1);
    expect(
      nativeExports.flatMap((node) =>
        node.observations.map(
          (observation) => observation.properties.requested_members,
        ),
      ),
    ).toEqual([["load"]]);
  },
);
