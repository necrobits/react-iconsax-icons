const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const babel = require('@babel/core');
const {minify} = require('terser');

const IconDirectory = './icons';
const BuildDirectory = './dist';
const CJXDirectory = path.join(BuildDirectory, '');
const ESMDirectory = path.join(BuildDirectory, 'esm');

const Variants = ['Bold', 'Broken', 'Bulk', 'Linear', 'Outline', 'TwoTone'];
const VariantSet = new Set(Variants);

function findSVGInDirectory(directory) {
    const svgFiles = [];
    fs.readdirSync(directory).forEach(file => {
        if (file.endsWith('.svg')) {
            svgFiles.push(file);
        }
    });
    return svgFiles;
}

function getIconPath(svgFile, variant) {
    return path.join(IconDirectory, variant.toLowerCase(), svgFile);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function lowercaseFirstLetter(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

function kebabToPascalCase(name) {
    return name.split('-').map(capitalizeFirstLetter).join('');
}

function kebabToCamelCase(name) {
    return lowercaseFirstLetter(kebabToPascalCase(name));
}

function svgFileToComponentName(file, variant) {
    if (!VariantSet.has(variant)) {
        throw `${variant} is not supported`;
    }
    const filename = path.parse(file).name;
    const normalizedName = filename.replace(/[^a-zA-Z0-9]/g, '-');
    const tempName = kebabToPascalCase(normalizedName) + variant;
    if (tempName.match('^\\d')) {
        return 'I' + tempName;
    }
    return tempName;
}

function convertAttrsToReactAttrs(attrs) {
    const pairs = Object.keys(attrs).map(key => {
        let val = attrs[key];
        if (key.match(/^(width|height)$/) && val.match('24')) val = '{size}';
        if (val.match(/^(#292D32)$/)) val = '{color}';
        const reactAttrName = kebabToCamelCase(key);
        return {[reactAttrName]: val};
    });
    return Object.assign({}, ...pairs);
}

function convertHtmlElementToReactElement(element) {
    element.attribs = convertAttrsToReactAttrs(element.attribs);
    element.children = element.children
        .filter(c => c.type === 'tag')
        .map(convertHtmlElementToReactElement);
    return element;
}

function makeIconTyping(componentName) {
    return `
import * as React from 'react';
declare function ${componentName}(props: React.SVGProps<SVGSVGElement>, ref: React.Ref<SVGSVGElement>): React.MemoExoticComponent<React.ForwardRefExoticComponent<React.RefAttributes<any>>>;
export default ${componentName};
`
}

const indexTypeDef = `
/// <reference types="react" />
import {FC, SVGAttributes, Ref} from 'react';
export interface IconProps extends SVGAttributes<SVGElement> {
    ref?: Ref<SVGSVGElement>;
    color?: string;
    size?: string | number;
}
export type Icon = FC<IconProps>;
`


async function transformSVGtoJSX(svgFile, variant, format) {
    const iconPath = getIconPath(svgFile, variant);
    const svgContent = fs.readFileSync(iconPath);
    const componentName = svgFileToComponentName(svgFile, variant);
    const $ = cheerio.load(svgContent);
    const elements = $('svg > *');
    elements.each((_, elem) => {
        elem = convertHtmlElementToReactElement(elem);
    })
    const reactStyleStr = elements.toString().replace(/\"?\{(.+?)\}\"?/g, "{$1}");
    const reactCode = `
import * as React from "react";
import PropTypes from "prop-types";

const ${componentName} = React.memo(React.forwardRef(({color, size, ...rest}, ref) => (
    <svg
        {...rest}
        xmlns="http://www.w3.org/2000/svg"
        ref={ref}
        width={size} height={size}
        viewBox="0 0 24 24"
        fill="none"
    >
        ${reactStyleStr}
    </svg>
)));
${componentName}.propTypes = {
    color: PropTypes.string,
    size: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};
${componentName}.defaultProps = {
    color: '#292D32',
    size: '24'
 };
${componentName}.displayName = '${componentName}';

export default ${componentName};
 `;
    const {code} = await babel.transformAsync(reactCode, {
        presets: [['@babel/preset-react', {useBuiltIns: true}]],
    });
    if (format === 'esm') {
        const {code: minifiedCode} = await minify(code);
        return minifiedCode;
    }

    const replaceESM = code
        .replace(
            'import * as React from "react";',
            'const React = require("react");'
        )
        .replace('export default', 'module.exports =');
    const {code: minifiedCode} = await minify(replaceESM);
    return minifiedCode;
}

function indexFileContent(componentNames, format, includeExtension = true) {
    let content = '';
    const extension = includeExtension ? '.js' : '';
    componentNames.map((componentName) => {

        const directoryString = `'./${componentName}${extension}'`;
        content +=
            format === 'esm'
                ? `export { default as ${componentName} } from ${directoryString};\n`
                : `module.exports.${componentName} = require(${directoryString});\n`;
    });
    return content;
}

async function build() {
    const svgFiles = findSVGInDirectory(path.join(IconDirectory, 'bold'));
    if (!fs.existsSync(BuildDirectory)) {
        fs.mkdirSync(BuildDirectory);
    }

    if (!fs.existsSync(path.join(CJXDirectory))) {
        fs.mkdirSync(CJXDirectory);
    }

    if (!fs.existsSync(path.join(ESMDirectory))) {
        fs.mkdirSync(ESMDirectory);
    }

    const components = [];
    console.log('Generating components...');
    const length = svgFiles.length;
    let i = 1;
    for (let svgFile of svgFiles) {
        console.log('Creating', `${i++}/${length}`);
        for (let variant of Variants) {
            const componentName = svgFileToComponentName(svgFile, variant)
            const outFilename = componentName + '.js';
            const typingFilename = componentName + '.d.ts';

            const cjsFilePath = path.join(CJXDirectory, outFilename);
            const cjsTypingFilePath = path.join(CJXDirectory, typingFilename);

            const esmFilePath = path.join(ESMDirectory,  outFilename);
            const esmTypingFilePath = path.join(ESMDirectory,  typingFilename);

            if (!fs.existsSync(getIconPath(svgFile, variant))) {
                continue;
            }
            const cjsCode = await transformSVGtoJSX(svgFile, variant, 'cjs');
            const esmCode = await transformSVGtoJSX(svgFile, variant, 'esm');
            const typingCode = makeIconTyping(componentName);

            // cjs
            fs.writeFileSync(cjsFilePath, cjsCode);
            fs.writeFileSync(cjsTypingFilePath, typingCode);

            // esm
            fs.writeFileSync(esmFilePath, esmCode);
            fs.writeFileSync(esmTypingFilePath, typingCode);

            components.push(componentName);
        }
    }
    // Write index.js
    console.log('Writing index...');
    fs.writeFileSync(path.join(CJXDirectory, 'index.js'), indexFileContent(components, 'cjs'), 'utf-8');
    fs.writeFileSync(path.join(ESMDirectory, 'index.js'), indexFileContent(components, 'esm'), 'utf-8');


    console.log('Writing index.d.ts');
    const indexDecComponents = components.map(cName => `export const ${cName}: Icon;\n`).join('');
    const indexDeclarationCode = indexTypeDef + indexDecComponents;
    fs.writeFileSync(path.join(CJXDirectory, 'index.d.ts'), indexDeclarationCode);
    fs.writeFileSync(path.join(ESMDirectory, 'index.d.ts'), indexDeclarationCode);

    console.log('Code generation completed.');
}

build();