// deno-lint-ignore-file no-explicit-any

export interface AutoSchemaFieldDef {
    key: string;
    type: string;
    parentKey: string;
    path: string;
    required: boolean;
    maxLength?: number;
}

export interface AutoSchemaCollection {
    key: string;
    type: string;
    path: string;
}

export interface AutoSchema {
    fields: AutoSchemaFieldDef[];
    collections?: Record<string, AutoSchemaCollection[]>;
}

export default class AutoSchemaBuilder {
    private keyTypes = new Map<string, { type: string; parent: string | null }>();
    private mergeCandidateFields: string[];
    private mergeChildrenDirectives: string[];
    private mergeDocumentFields: string[];
    private rootCollection: string | null;

    constructor(
        private raw: any,
        config: { merge?: string[]; merge_children?: string[]; documents?: string[]; root?: string }
    ) {
        this.mergeCandidateFields = config.merge ?? [];
        this.mergeChildrenDirectives = config.merge_children ?? [];
        this.mergeDocumentFields = config.documents ?? [];
        this.rootCollection = config.root ?? null;
    }

    public GenerateSchema(): { fields: AutoSchemaFieldDef[]; collections: Record<string, AutoSchemaCollection[]> } {
        this.traverse(this.raw);
        const sortedKeys = Array.from(this.keyTypes.keys()).sort();

        // build fields
        const fields: AutoSchemaFieldDef[] = sortedKeys.map((keyName) => {
            const entry = this.keyTypes.get(keyName)!;
            const parentKey = entry.parent === null ? 'root' : entry.parent;
            const path = this.buildFieldPath(keyName, entry.parent);
            const field: AutoSchemaFieldDef = { key: keyName, type: entry.type, parentKey, path, required: true };
            if (entry.type === 'string') {
                field.maxLength = 255;
            }
            return field;
        });

        // build collections
        const collections: Record<string, AutoSchemaCollection[]> = {};
        // root collection
        if (this.rootCollection) {
            const entries: AutoSchemaCollection[] = fields
                .filter((f) => f.parentKey === 'root' && f.key !== this.rootCollection && f.type !== 'collection')
                .map((f) => ({ key: f.key, type: f.type, path: f.path }));
            collections[this.rootCollection.toLowerCase()] = entries;
        }

        // each root-level collection
        const rootCols = fields.filter((f) => f.type === 'collection' && f.parentKey === 'root');
        for (const col of rootCols) {
            const name = col.key.toLowerCase();
            const items: AutoSchemaCollection[] = [];
            if (this.mergeDocumentFields.includes(col.key)) {
                const group = this.raw[col.key];
                let first: any = undefined;
                if (Array.isArray(group)) {
                    first = group[0];
                } else if (group && typeof group === 'object') {
                    first = Object.values(group)[0];
                }
                if (first && typeof first === 'object') {
                    for (const childKey of Object.keys(first)) {
                        const fld = fields.find((f) => f.key === childKey && f.parentKey === col.key);
                        if (fld) items.push({ key: fld.key, type: fld.type, path: fld.path });
                    }
                }
            } else {
                const children = fields.filter((f) => f.parentKey === col.key);
                for (const c of children) items.push({ key: c.key, type: c.type, path: c.path });
            }
            collections[name] = items;
        }

        // handle nested collections inside document arrays or dictionaries (e.g., orders or coupons inside customers)
        for (const col of rootCols) {
            const group = this.raw[col.key];
            let firstDoc: any = undefined;
            if (Array.isArray(group)) {
                firstDoc = group[0];
            } else if (group && typeof group === 'object') {
                firstDoc = Object.values(group)[0];
            }
            if (firstDoc && typeof firstDoc === 'object') {
                for (const [childKey, childVal] of Object.entries(firstDoc)) {
                    // If childVal is an array of objects
                    if (Array.isArray(childVal) && childVal.length > 0 && typeof childVal[0] === 'object') {
                        const nestedColName = childKey.toLowerCase();
                        const nestedItems: AutoSchemaCollection[] = [];
                        // Add parent id field
                        nestedItems.push({ key: `${col.key}Id`, type: 'string', path: this.buildFieldPath(`${col.key}Id`, nestedColName) });
                        for (const nestedFieldKey of Object.keys(childVal[0])) {
                            const fld = fields.find((f) => f.key === nestedFieldKey && f.parentKey === childKey);
                            if (fld) nestedItems.push({ key: fld.key, type: fld.type, path: fld.path });
                        }
                        const filtered = nestedItems.filter((e) => e.key !== 'id');
                        filtered.unshift({ key: 'id', type: 'string', path: this.buildFieldPath('id', nestedColName) });
                        collections[nestedColName] = filtered;
                    }
                    // If childVal is a dictionary of objects
                    else if (childVal && typeof childVal === 'object' && !Array.isArray(childVal)) {
                        const dictValues = Object.values(childVal);
                        if (dictValues.length > 0 && typeof dictValues[0] === 'object') {
                            const nestedColName = childKey.toLowerCase();
                            const nestedItems: AutoSchemaCollection[] = [];
                            // Add parent id field
                            nestedItems.push({ key: `${col.key}Id`, type: 'string', path: this.buildFieldPath(`${col.key}Id`, nestedColName) });
                            for (const nestedFieldKey of Object.keys(dictValues[0])) {
                                const fld = fields.find((f) => f.key === nestedFieldKey && f.parentKey === childKey);
                                if (fld) nestedItems.push({ key: fld.key, type: fld.type, path: fld.path });
                            }
                            const filtered = nestedItems.filter((e) => e.key !== 'id');
                            filtered.unshift({ key: 'id', type: 'string', path: this.buildFieldPath('id', nestedColName) });
                            collections[nestedColName] = filtered;
                        }
                    }
                }
            }
        }

        // inline merges and ensure id
        for (const [name, list] of Object.entries(collections)) {
            // inline merge
            let result: AutoSchemaCollection[] = [];
            for (const e of list) {
                if (e.type === 'merge') {
                    const merged = fields.filter((f) => f.parentKey === e.key)
                        .map((f) => ({ key: `$json.${e.key}.${f.key}`, type: f.type, path: this.buildFieldPath(f.key, e.key) }));
                    result.push(...merged);
                } else {
                    result.push(e);
                }
            }
            // remove any id and re-add one id at top
            result = result.filter((e) => e.key !== 'id');
            result.unshift({ key: 'id', type: 'string', path: this.buildFieldPath('id', name) });
            collections[name] = result;
        }

        return { fields: fields, collections };
    }

    private getBaseAppwriteType(value: any): string {
        const t = typeof value;
        if (t === 'string') return 'string';
        if (t === 'number') return Number.isInteger(value) ? 'integer' : 'double';
        if (t === 'boolean') return 'boolean';
        if (Array.isArray(value)) return 'collection';
        if (t === 'object' && value !== null) return 'collection';
        return 'collection';
    }

    private traverse(node: any, parent: string | null = null, forceMerge = false): void {
        if (Array.isArray(node)) {
            for (const v of node) this.traverse(v, parent, forceMerge);
        } else if (node && typeof node === 'object') {
            for (const [key, val] of Object.entries(node)) {
                if (val !== null) {
                    let type = this.getBaseAppwriteType(val);
                    const isObj = typeof val === 'object' && val !== null;
                    if (isObj && parent === null && this.mergeDocumentFields.includes(key)) type = 'collection';
                    else if (forceMerge && isObj) type = 'merge';
                    else if (isObj && this.mergeCandidateFields.includes(key)) type = 'merge';

                    if (this.keyTypes.has(key)) {
                        const existing = this.keyTypes.get(key)!;
                        // simple override precedence
                        if (type === 'merge' || existing.type === 'merge') existing.type = 'merge';
                        else if (type === 'collection' || existing.type === 'collection') existing.type = 'collection';
                        this.keyTypes.set(key, { type: existing.type, parent: existing.parent });
                    } else {
                        this.keyTypes.set(key, { type, parent });
                    }
                }
                if (val !== null && typeof val === 'object') {
                    const nextForce = this.mergeChildrenDirectives.includes(key) && !this.mergeDocumentFields.includes(key);
                    this.traverse(val, key, nextForce);
                }
            }
        }
    }

    private buildFieldPath(name: string, parent: string | null): string {
        return !parent || parent === 'root' ? `root.${name}` : `root.${parent}.${name}`;
    }
}
