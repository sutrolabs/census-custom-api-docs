### RPC Details

Your connector must implement each of these methods to work with Census:

#### test_connection : Verify that the custom connection is working

Census calls this method when a user presses the "Test Connection" button on
your custom connection. When this is invoked, you should do something to test
that the connection to your upstream SaaS application is working correctly -
specifically, it's useful to verify API keys.

##### Request

This method has no parameters - the request parameters will always be an empty
JSON object

```json
{
  "jsonrpc": "2.0",
  "method": "test_connection",
  "id": "d33ded2672b7877ff833c317892d748c",
  "params": {}
}
```

##### Response

This method has two possible responses. On success, you should respond with:

```json
{
  "jsonrpc": "2.0",
  "id": "d33ded2672b7877ff833c317892d748c",
  "result":{
    "success":true
  }
}
```

If an error occurs performing the connection test, respond with:

```json
{
  "jsonrpc": "2.0",
  "id": "d33ded2672b7877ff833c317892d748c",
  "result":{
    "success": false,
    "error_message": "The API Key is invalid"
  }
}
```

#### list_objects : List all the objects supported by the custom connection

Census calls this method periodically (in response to UI interaction as well as
proactively in the background to warm its caches) to get the list of objects
your connector supports as sync destinations. Your connector will be useless
unless you respond with at least one object.

Objects have both labels (for humans) and API names. These may be the same
value, but they do not have to be. The API name is an identifier chosen by you
that acts as the primary key for an object; an object's label may change over
time, but its API name must not. You should choose API names that correspond
with long-lived identifiers in your destination SaaS.

##### Request

This method has no parameters - the request will always be an empty JSON object

```json
{
  "jsonrpc": "2.0",
  "method": "list_objects",
  "id": "6d2bd06835a565bee3e2250177f1d738"
  "params": {}
}
```

##### Response

```json
{
  "jsonrpc": "2.0",
  "method": "list_objects",
  "id": "6d2bd06835a565bee3e2250177f1d738"
  "result": {
    "objects": [
      {"object_api_name": "restaurant", "label": "Restaurants"},
      {"object_api_name": "venue", "label": "Concert Venues"},
    ]
  }
}
```

#### list_fields : List all the fields for a given object

Census calls this method periodically to get the list of fields for a supported
object. An object must have at least one field with `identifer` set to `true`,
or it cannot be the destination of a Census sync.

A field's description consists of these required properties:
* `field_api_name` (string): A unique, unchanging identifier for this field
* `label` (string): A human-friendly name for the field
* `identifer` (boolean): If true, this field can act as a shared identifier in a
  Census sync. In order to be used an an identifier, a field must fulfill a few
  constraints:
  * It must be unique
  * It must be required
  * It should be easy to create or update records in the destination SaaS by
    this value
* `createable` (boolean): If true, this field can be populated on record
  creation in the destination SaaS. This will be true for most fields. An
  example of a non-creatable field would be something like an auto-populated
  "Created At" timestamp that you're not able to write to using the SaaS API.
* `updateable` (boolean): Similar to above - if true, this field can be
  populated when updating an existing record. Generally speaking, if a field is
  neither `createable` nor `updateable`, you might consider omitting it entirely
  from the `list_fields` response, as it won't be usable by Census for any
  syncs.
* `type` (string): The data type for this field. Census uses this to plan any
  "type casts" required to translate data from your data warehouse to your SaaS,
  to warn of invalid or lossy type casts, and will format the data on the wire
  to your custom connector using this type information. If `identifier` is
  `true`, the type must be `string` or `integer`. See the table below for the
  full list of types.
* `array` (boolean): If true, this field accepts an array of values instead of a
  single value. Any type can be used as an `array` type, but `array` types
  cannot be `identifier`s. Census will require array fields to have a matching
  array field in the mapped data warehouse column.

##### Supported Data Types

| Type      | Can Be Identifier? | JSON Wire Type | JSON Wire Example      | Notes                                                                                                                                                               |
|-----------|--------------------|----------------|------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| boolean   | No                 | boolean        | true                   |                                                                                                                                                                     |
| decimal   | No                 | string         | "1234.1234"            | Fixed-point decimal numbers are sent as strings to avoid loss of precision                                                                                          |
| float     | No                 | number         | 42.42                  | Consider the decimal type instead for numeric data warehouse columns                                                                                                |
| integer   | Yes                | number         | 4242                   |                                                                                                                                                                     |
| date      | No                 | string         | "2021-03-29"           | JSON does not have a date type, so dates are ISO 8601 strings                                                                                                       |
| date_time | No                 | string         | "2021-03-29T16:32:23Z" | JSON does not have a datetime or time type, so date times are ISO 8601 strings. A time zone will always be included - your custom connector must be time-zone aware |
| string    | Yes                | string         | "pizza"                | String encoding follows the JSON standard                                                                                                                           |


##### Request

```json
{
  "jsonrpc": "2.0",
  "method": "list_fields",
  "id": "TODO"
  "params": {
    "object": {"object_api_name": "restaurant", "label": "Restaurants"},
  }
}
```

##### Response

```json
{
  "jsonrpc": "2.0",
  "method": "list_fields",
  "id": "TODO",
  "result": {
    "fields": [
      {
        "field_api_name": "name",
        "label": "Name",
        "identifier": true,
        "createable": true,
        "updateable": true,
        "type": "string",
        "array": false,
      },
      {
        "field_api_name": "outdoor_dining",
        "label": "Outdoor Dining?",
        "identifier": false,
        "createable": true,
        "updateable": true,
        "type": "boolean",
        "array": false,
      },
      {
        "field_api_name": "zip",
        "label": "ZIP Code",
        "identifier": false,
        "createable": true,
        "updateable": true,
        "type": "decimal",
        "array": false,
      },
      {
        "field_api_name": "tag_list",
        "label": "Tags",
        "identifier": false,
        "createable": true,
        "updateable": true,
        "type": "string",
        "array": true,
      }
    ]
  }
}
```

#### supported_operations : List the operations that can be performed on an object

Census calls this method when a user is setting up a sync to your custom
connector to determine how data should be copied to your object. You should
advertise all the operations you are capable of supporting - the Census user
will pick one of them from your supported list when they are configuring their
sync. Currently, custom connectors support these operations:

* `upsert`: Look for a matching record in the SaaS - if it is present, update
  its fields with the new values, if not, create it. This is the most commonly
  used operation.
* `insert`: If a matching record is not present in the SaaS, create it. If it is
  present, skip syncing this record.
* `update`: If a matching record is present in the SaaS, update it with new
  field values. If it is not present, do not create it and skip syncing it.

##### Request

```json
{
  "jsonrpc": "2.0",
  "method": "supported_operations",
  "id": "TODO"
  "params": {
    "object": {"object_api_name": "restaurant", "label": "Restaurants"},
  }
}
```

##### Response

```json
{
  "jsonrpc": "2.0",
  "method": "supported_operations",
  "id": "TODO",
  "result": {
    "operations": ["upsert", "update"],
  }
}
```

#### get_sync_speed : Tell Census what batch sizes and sync speeds should be used

Census will call this method just before a sync is starting to determine how
much and how quickly it should send data to your custom connector. In order to
make your connector as easy to implement as possible, Census allows you to
configure the batch sizes, maximum throughput, and maximum parallelism it should
use when sending you data.

TODO this could use a diagram

Your response should include these three values:
* `maximum_batch_size`: How many records Census should include in each call to
  `sync_batch` (see below). Census may give your service smaller batches than
  this, but it will never send larger batches. If you SaaS API has a batch API,
  you should strongly consider setting this value to match you SaaS's maximum
  batch size. If your SaaS does not have a batch import API, we recommend
  setting this to a relatively low value (under 100) then testing the
  performance of your custom connector with different batch sizes.
* `maximum_parallel_batches`: How many simultaneous invocations of `sync_batch`
  Census will perform. It's generally safe to set this to a large number and
  control your sync speed using the other two variables, but if your underlying
  infrastructure (web server or function-as-a-service provider) limits the
  number of parallel calls to your function, you can use this parameter to stay
  under that limit and avoid queueing at the network layer.
* `maximum_records_per_second`: How many records (not batches) Census will send
  to you custom connector per second, across all parallel batches. This should
  be matched to your SaaS API's maximum records per secord, possibly with some
  buffer to allow for measurement error. The actual records per second may be
  limited by the batch size, number of parallel batches, and the average time it
  takes for your connector to complete one batch, but Census will attempt to
  never exceed this number.

Known Issue: Currently these "speed limits" are enforced at the sync level, not
across the entire connector, so two simultaneous syncs to different objects on
the same connector may cause these limits to be exceeded.

##### Request

```json
{
  "jsonrpc": "2.0",
  "method": "get_sync_speed",
  "id": "TODO"
  "params": {
    "sync_plan": {
      "object": {
        "object_api_name": "restaurant",
        "label": "Restaurants"
      }
      "operation": "upsert",
      "schema": {
        "name": {
          "active_identifier": true,
          "field": {
            "field_api_name": "name",
            "label": "Name",
            "identifier": true,
            "createable": true,
            "updateable": true,
            "type": "string",
            "array": false,
          }
        },
        "zip": {
          "active_identifier": false,
          "field": {
            "field_api_name": "zip",
            "label": "ZIP Code",
            "identifier": false,
            "createable": true,
            "updateable": true,
            "type": "decimal",
            "array": false,
          },
        },
        "tag_list": {
          "active_identifier": false,
          "field": {
            "field_api_name": "tag_list",
            "label": "Tags",
            "identifier": false,
            "createable": true,
            "updateable": true,
            "type": "string",
            "array": true,
          }
        }
      }
    }
  }
}
```

##### Response

```json
{
  "jsonrpc": "2.0",
  "id": "TODO",
  "result": {
    "maximum_batch_size": 5,
    "maximum_parallel_batches": 8
    "maximum_records_per_second": 100,
  }
}
```


#### sync_batch : Load one batch of data from Census to your destination application

This is the actual "data transfer" method in the API - once configuration is
performed and a sync plan is made, Census will call this method repeatedly with
batches of data from your warehouse that are ready to load.

This API should attempt to load all of the records in the batch, and must return
a success or failure message to Census for each attempted record. It is
extremely important that you only tell Census that a record succeeded if you are
certain of it - once Census records that a record has been successfully synced,
that record may never be copied again (if it never changes). Census assumes that
all records that are not explicitly reported as successes have failed, and
should be retried, but providing an explicit failure message can be helpful to
the users of your custom connector so they can fix any data issues.

Census employs a hierarchical retry strategy - syncs are retried at the record
level, at the batch level, and at the sync level, so if you are unsure if a
record or batch has succeeded, we encourage you to fail fast and rely on Census
to retry as the best way to avoid data integrity issues.

##### Request

```json
{
  "jsonrpc": "2.0",
  "method": "sync_batch",
  "id": "TODO"
  "params": {
    "sync_plan": {
      "object": {
        "object_api_name": "restaurant",
        "label": "Restaurants"
      }
      "operation": "upsert",
      "schema": {
        "name": {
          "active_identifier": true,
          "field": {
            "field_api_name": "name",
            "label": "Name",
            "identifier": true,
            "createable": true,
            "updateable": true,
            "type": "string",
            "array": false,
          }
        },
        "zip": {
          "active_identifier": false,
          "field": {
            "field_api_name": "zip",
            "label": "ZIP Code",
            "identifier": false,
            "createable": true,
            "updateable": true,
            "type": "decimal",
            "array": false,
          },
        },
        "tag_list": {
          "active_identifier": false,
          "field": {
            "field_api_name": "tag_list",
            "label": "Tags",
            "identifier": false,
            "createable": true,
            "updateable": true,
            "type": "string",
            "array": true,
          }
        }
      }
    },
    "records" : [
      {"name": "Ashley's", "zip": "48104", "tags": ["Bar", "Brewpub"]},
      {"name": "Seva", "zip": 48103, "tags": ["Vegan", "Casual"]},
      {"name": "Pizza House", "zip": 48104, "tags": ["Pizzeria", "Sports Bar"]},
      {"name": "Zingerman's Delicatessen", "zip": 48104, "tags": ["Deli", "Specialty"]},
      {"name": "Gandy Dancer", "zip": 48104, "tags": ["American", "Seafood", "Historic", "Cocktails"]}
    ]
  }
}
```

##### Response

```json
{
  "jsonrpc": "2.0",
  "id": "TODO",
  "result": {
    "record_results": [
      {"identifier": "Ashley's", "success": true},
      {"identifier": "Seva", "success": true},
      {"identifier": "Pizza House", "success": false, "error_message": "API Error, please retry"},
      {"identifier": "Zingerman's Delicatessen", "success": true},
      {"identifier": "Gandy Dancer", "success": false, "error_message": "Exceeded tag limit of 3"}
    ]
  }
}
```

