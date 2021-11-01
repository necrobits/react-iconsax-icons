const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const IconDirectory = './icons';
const BuildDirectory = './build';
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
    const tempName = kebabToPascalCase(filename) + variant;
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

function convertHtmlElementToReactElement(element){
    console.log("Processing", element.name);
    element.attribs = convertAttrsToReactAttrs(element.attribs);
    element.children = element.children.map(convertHtmlElementToReactElement);
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

export const ${componentName} = forwardRef(({color, size, ...rest}, ref) => (
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
));
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


function build() {
    const svgFiles = findSVGInDirectory(path.join(IconDirectory, 'bold'));
    if (!fs.existsSync(BuildDirectory)){
        fs.mkdirSync(BuildDirectory);
    }
    const outFilename = svgFileToComponentName('3d-cube-scan.svg','TwoTone') + '.js';
    const outFilePath = path.join(BuildDirectory, outFilename);
    const reactCode = convertSVGToReactComponent('3d-cube-scan.svg', 'TwoTone');
    return;

    for (let svgFile of svgFiles){
        for (let variant of Variants){
            console.log("Process", svgFile, variant);
            const outFilename = svgFileToComponentName(svgFile,variant) + '.js';
            const outFilePath = path.join(BuildDirectory, outFilename);
            if (!fs.existsSync(getIconPath(svgFile, variant))){
                continue;
            }
            const reactCode = convertSVGToReactComponent(svgFile, variant);
            fs.writeFileSync(outFilePath, reactCode);
        }

    }
}

build()