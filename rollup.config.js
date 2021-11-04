import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

export default {
    preserveModules: true,
    input: "src/index.ts",
    output: [
        {
            dir: 'lib',
            format: "cjs",
            sourcemap: false,

        },
        {
            dir: 'lib/esm',
            format: "esm",
            sourcemap: false,

        },
    ],
    external: ["react"],
    plugins: [
        resolve(),
        commonjs(),
        typescript({
            useTsconfigDeclarationDir: true,
            tsconfig: "tsconfig.json",
            clean: true
        }),
    ],
};
