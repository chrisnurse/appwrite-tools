// deno-lint-ignore-file no-explicit-any
import { assert } from "https://deno.land/std@0.195.0/assert/assert.ts";
import { dirname, fromFileUrl, join } from "https://deno.land/std@0.195.0/path/mod.ts";
import AutoSchemaBuilder from "../seed/AutoSchemaBuilder.ts";
import AppwriteCollectionsBuilder from "../seed/AppwriteCollectionsBuilder.ts";

Deno.test("JsDbSchema generates expected schema and collections", async (t) => {
    //#region setup
    const baseDir = dirname(fromFileUrl(import.meta.url));

    // *** Change contentFile to be the basic name of your test file and then 
    // *** it will be assumed you have a json file, a file with the same name appended with -merge.json
    // *** and an output file with the same name appended with -schema.json
    const contentFile = "demo";
    const contentJsonPath = join(baseDir, `${contentFile}.json`);
    const mergeConfigPath = join(baseDir, `${contentFile}-merge.json`);
    const outputPath = join(baseDir, `${contentFile}-schema.json`);

    // Load input JSON and merge configuration
    const rawText = await Deno.readTextFile(contentJsonPath);
    const mergeText = await Deno.readTextFile(mergeConfigPath);
    const rawData = JSON.parse(rawText);
    const mergeConfig = JSON.parse(mergeText);

    //#endregion

    // Generate schema
    const schemaTool = new AutoSchemaBuilder(rawData, mergeConfig);
    const DbSchema = schemaTool.GenerateSchema();

    await t.step("Schema save", async () => {
        await Deno.writeTextFile(outputPath, JSON.stringify(DbSchema, null, 2));

        // Assert root collection exists
        assert(DbSchema.collections, "collections should be defined");
        const rootName = mergeConfig.root.toLowerCase();
        assert(DbSchema.collections[rootName] !== undefined, `root collection '${rootName}' should exist`);
    });

    await t.step("Schema file collections contains customers and orders", async () => {
        const schemaText = await Deno.readTextFile(outputPath);
        const schemaJson = JSON.parse(schemaText);
        assert(schemaJson.collections, "collections should be defined in schema file");
        assert(schemaJson.collections.customer !== undefined, "collections should contain 'customer'");
        assert(schemaJson.collections.order !== undefined, "collections should contain 'order'");
        assert(schemaJson.collections.coupon !== undefined, "collections should contain 'coupon'");
    });

    await t.step("Generate Appwrite Collections", async () => {
        // load appwrite.json
        const appwriteFile = "appwrite.json";
        const appwriteJsonPath = join(baseDir, appwriteFile);
        const appwriteText = await Deno.readTextFile(appwriteJsonPath);
        const appwriteConfig = JSON.parse(appwriteText);

        const appwrite_generator = new AppwriteCollectionsBuilder(appwriteConfig, DbSchema);
        const new_config: any = appwrite_generator.generateCollections();

        assert(new_config, "should have an updated config");
        assert(new_config.collections, "collections should be defined in appwrite config");

        const customer = new_config.collections.find((c: { $id: string; }) => c.$id == "customer")
        const order = new_config.collections.find((c: { $id: string; }) => c.$id == "order")
        const coupon = new_config.collections.find((c: { $id: string; }) => c.$id == "coupon")

        assert(customer, "collections should contain 'customer'");
        assert(order, "collections should contain 'order'");
        assert(coupon, "collections should contain 'coupon'");

        // Save the updated appwrite config
        const appwriteOutputPath = join(baseDir, "appwrite-updated.json");
        await Deno.writeTextFile(appwriteOutputPath, JSON.stringify(new_config, null, 2));
    });
});