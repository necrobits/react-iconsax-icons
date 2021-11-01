const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { join } = require('path');

const IconDirectory = './icons';
const BuildDirectory = './dist';
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
        return { [reactAttrName]: val };
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

function convertSVGToReactComponent(svgFile, variant) {
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
import React from 'react';
import PropTypes from 'prop-types';

export const ${componentName} = React.memo(forwardRef(({color, size, ...rest}, ref) => (
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
    size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
${componentName}.defaultProps = {
    color: '#292D32',
    size: '24',
 };
${componentName}.displayName = '${componentName}';
 `;
    return reactCode;
}

function makeIconTyping(componentName) {
    return `
import { ${componentName} } from './${componentName}';
export ${componentName};    
`
}

const indexTypeDef = `
/// <reference types="react" />
import {FC, SVGAttributes, Ref} from 'react';
export interface IconProps extends SVGAttributes<SVGElement> {
    ref?: <SVGSVGElement>;
    color?: string;
    size?: string | number;
}
export type Icon = FC<IconProps>;
`

function build() {
    const svgFiles = findSVGInDirectory(path.join(IconDirectory, 'bold'));
    if (!fs.existsSync(BuildDirectory)) {
        fs.mkdirSync(BuildDirectory);
    }
    const components = [];
    console.log('Generating components...');
    for (let svgFile of svgFiles) {
        for (let variant of Variants) {
            const componentName = svgFileToComponentName(svgFile, variant)
            const outFilename = componentName + '.js';
            const outFilePath = path.join(BuildDirectory, outFilename);
            if (!fs.existsSync(getIconPath(svgFile, variant))) {
                continue;
            }
            const reactCode = convertSVGToReactComponent(svgFile, variant);
            fs.writeFileSync(outFilePath, reactCode);
            components.push(componentName);
        } 
    }
    // Write index.js
    console.log('Writing index...');
    const indexCode = components.map(cName => `export {${cName}} from './${cName}';\n`).join('');
    fs.writeFileSync(path.join(BuildDirectory, 'index.js'), indexCode);

    console.log('Writing index.d.ts');
    const indexDecComponents = components.map(cName => `export const ${cName}: Icon;\n`).join('');
    const indexDeclarationCode = indexTypeDef + indexDecComponents;
    fs.writeFileSync(path.join(BuildDirectory, 'index.d.ts'), indexDeclarationCode);
    console.log('Code generation completed.');
}

build();