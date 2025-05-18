// AppwriteCollectionsGenerator.ts
// Generates the 'collections' node for appwrite.json in the correct Appwrite format from a schema.

import type { AutoSchema, AutoSchemaCollection } from "./AutoSchemaBuilder.ts";

// Use Record<string, unknown> for loose typing of appwrite config
export default class AppwriteCollectionsBuilder {
    private appwriteConfig: Record<string, unknown>;
    private schema: AutoSchema;

    constructor(appwriteConfig: Record<string, unknown>, schema: AutoSchema) {
        this.appwriteConfig = JSON.parse(JSON.stringify(appwriteConfig)); // deep clone
        this.schema = schema;
    }

    public generateCollections(): Record<string, unknown> {
        // Find the databaseId from the first database (required by Appwrite)
        const databases = this.appwriteConfig.databases as { $id: string }[] | undefined;
        const databaseId = Array.isArray(databases) && databases.length > 0 ? databases[0].$id : "default";

        // Generate collections in Appwrite format
        const collections = Object.entries(this.schema.collections ?? {}).map(([name, fields]) => {
            const typedFields = fields as AutoSchemaCollection[];
            return {
                $id: name,
                $permissions: [],
                databaseId: databaseId,
                name: name,
                enabled: true,
                documentSecurity: false,
                attributes: typedFields
                    .filter(f => f.key !== 'id') // Ignore 'id' field
                    .map(f => ({
                        key: f.key,
                        type: f.type,
                        required: true,
                        array: false,
                        size: f.type === 'string' ? 255 : undefined,
                        default: null
                    })),
                indexes: []
            };
        });

        // Replace the collections node
        (this.appwriteConfig as { collections: unknown }).collections = collections;
        return this.appwriteConfig;
    }
}
