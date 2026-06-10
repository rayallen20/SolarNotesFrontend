/**
 * @typedef {Object} CatalogueNode 目录树节点
 * @property {Number} id 节点唯一id
 * @property {String} type folder: 文件夹; file: 文件
 * @property {String} name 节点名称
 * @property {String} [intro] 文件夹简介(仅当节点类型为folder时存在的字段)
 * @property {String} createdAt 创建日期(格式: YYYY-MM-DD)
 * @property {Array<CatalogueNode>} [children] 子节点列表(仅当节点类型为folder时存在的字段)
 * */
export const treeData = {
    id: 1,
    type: 'folder',
    name: '根文件夹名称',
    intro: '根文件夹的简介',
    createdAt: '2025-12-31',
    children: [
        {
            id: 2,
            type: 'folder',
            name: '子文件夹A名称',
            intro: '子文件夹A的简介',
            createdAt: '2026-01-01',
            children: [
                {
                    id: 3,
                    type: 'file',
                    name: '文件A-1名称',
                    createdAt: '2026-01-05',
                },
                {
                    id: 4,
                    type: 'file',
                    name: '文件A-2名称',
                    createdAt: '2026-01-06',
                },
            ]
        },
        {
            id: 5,
            type: 'folder',
            name: '子文件夹B名称',
            intro: '子文件夹B的简介',
            createdAt: '2026-01-02',
            children: [
                {
                    id: 6,
                    type: 'folder',
                    name: '子文件夹B-1名称',
                    intro: '子文件夹B-1的简介',
                    createdAt: '2026-01-03',
                    children: [
                        {
                            id: 7,
                            type: 'file',
                            name: '文件B-1-1名称',
                            createdAt: '2026-01-07',
                        },
                        {
                            id: 8,
                            type: 'file',
                            name: '文件B-1-2名称',
                            createdAt: '2026-01-08',
                        },
                    ],
                },
                {
                    id: 9,
                    type: 'folder',
                    name: '子文件夹B-2名称',
                    intro: '子文件夹B-2的简介',
                    createdAt: '2026-01-04',
                    children: [
                        {
                            id: 10,
                            type: 'file',
                            name: '文件B-2-1名称',
                            createdAt: '2026-01-09',
                        },
                        {
                            id: 11,
                            type: 'file',
                            name: '文件B-2-2名称',
                            createdAt: '2026-01-10',
                        },
                    ],
                },
            ],
        },
        {
            id: 12,
            type: 'folder',
            name: '子文件夹C名称',
            intro: '子文件夹C的简介',
            createdAt: '2026-01-11',
            children: [
                {
                    id: 13,
                    type: 'folder',
                    name: '子文件夹C-1名称',
                    intro: '子文件夹C-1的简介',
                    createdAt: '2026-01-12',
                    children: [
                        {
                            id: 14,
                            type: 'file',
                            name: '文件C-1-1名称',
                            createdAt: '2026-01-13',
                        },
                        {
                            id: 15,
                            type: 'file',
                            name: '文件C-1-2名称',
                            createdAt: '2026-01-14',
                        },
                    ],
                },
                {
                    id: 16,
                    type: 'folder',
                    name: '子文件夹C-2名称',
                    intro: '子文件夹C-2的简介',
                    createdAt: '2026-01-15',
                    children: [
                        {
                            id: 17,
                            type: 'file',
                            name: '文件C-2-1名称',
                            createdAt: '2026-01-16',
                        },
                        {
                            id: 18,
                            type: 'file',
                            name: '文件C-2-2名称',
                            createdAt: '2026-01-17',
                        },
                    ],
                },
            ],
        },
        {
            id: 19,
            type: 'folder',
            name: '子文件夹D名称',
            intro: '子文件夹D的简介',
            createdAt: '2026-01-11',
            children: [
                {
                    id: 20,
                    type: 'folder',
                    name: '子文件夹D-1名称',
                    intro: '子文件夹D-1的简介',
                    createdAt: '2026-01-12',
                    children: [
                        {
                            id: 21,
                            type: 'file',
                            name: '文件D-1-1名称',
                            createdAt: '2026-01-13',
                        },
                        {
                            id: 22,
                            type: 'file',
                            name: '文件D-1-2名称',
                            createdAt: '2026-01-14',
                        },
                    ],
                },
                {
                    id: 23,
                    type: 'folder',
                    name: '子文件夹D-2名称',
                    intro: '子文件夹D-2的简介',
                    createdAt: '2026-01-15',
                    children: [
                        {
                            id: 24,
                            type: 'file',
                            name: '文件D-2-1名称',
                            createdAt: '2026-01-16',
                        },
                        {
                            id: 25,
                            type: 'file',
                            name: '文件D-2-2名称',
                            createdAt: '2026-01-17',
                        },
                    ],
                },
            ],
        },
        {
            id: 26,
            type: 'folder',
            name: '子文件夹E名称',
            intro: '子文件夹E的简介',
            createdAt: '2026-01-11',
            children: [
                {
                    id: 27,
                    type: 'folder',
                    name: '子文件夹E-1名称',
                    intro: '子文件夹E-1的简介',
                    createdAt: '2026-01-12',
                    children: [
                        {
                            id: 28,
                            type: 'file',
                            name: '文件E-1-1名称',
                            createdAt: '2026-01-13',
                        },
                        {
                            id: 29,
                            type: 'file',
                            name: '文件E-1-2名称',
                            createdAt: '2026-01-14',
                        },
                    ],
                },
                {
                    id: 30,
                    type: 'folder',
                    name: '子文件夹E-2名称',
                    intro: '子文件夹E-2的简介',
                    createdAt: '2026-01-15',
                    children: [
                        {
                            id: 31,
                            type: 'file',
                            name: '文件E-2-1名称',
                            createdAt: '2026-01-16',
                        },
                        {
                            id: 32,
                            type: 'file',
                            name: '文件E-2-2名称',
                            createdAt: '2026-01-17',
                        },
                    ],
                },
            ],
        },
    ]
}