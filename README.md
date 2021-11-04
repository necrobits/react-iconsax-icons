# Iconsax for ReactJS

This is the component library for [Iconsax Icons v1](https://iconsax.io/). **Tree-shaking** is supported, so you can keep your build minimal.  

The original repository for **Iconsax** can be found here: https://github.com/lusaxweb/iconsax

## Installation
```
npm i react-iconsax-icons
```
or
```
yarn add react-iconsax-icons
```

## Usage
The naming style is `IconName + VariantName`. There are 6 variants:
- Linear
- Bold
- Bulk
- Broken
- Outline
- TwoTone

For example, `airplane-square.svg` in `Bold` variant would be `<AirplaneSquareBold />`.

You can use `color` and `size` to configure the appearance.
```jsx
import React from 'react';
import { ActivityBold } from 'react-iconsax-icons';

const MyComponent = () => {
    return <ActivityBold color="#333333" size={32} />;
}; 
```

If the SVG file name starts with a number, such as `24-support.svg`, just add `I` before the name: `<I24Support />`


## Props
| Name | Type               | Default |
|----------|--------------------|---------|
|`color`   |`string`            |`#292D32`|
|`size`    |`string` \| `number`|`24`     |


## License
MIT