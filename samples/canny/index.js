// Mimimal canny custom destination implementation

const { default: axios } = require("axios");
const { Destination } = require("./destination");

const isCustomField = (fieldName, objectName) => {
  const objectFields = CANNY_OBJECTS[objectName].fields.map(f => f.field_api_name);
  return !objectFields.includes(fieldName);
}

const upsertUserRecord = (record) => {
  const customFields = Object.keys(record)
    .filter(f => isCustomField(f, 'user'))
    .reduce((obj, key) => ({ ...obj, [key]: record[key] }), {});
  const filteredRecord = Object.keys(record)
    .filter(f => !isCustomField(f, 'user'))
    .reduce((obj, key) => ({ ...obj, [key]: record[key] }), {});

  const uploadRecord = { customFields, ...filteredRecord };
  return axios.post('https://canny.io/api/v1/users/create_or_update', {
    apiKey: process.env.CANNY_API_KEY,
    ...uploadRecord
  });
}

const updateCompanyRecord = (record) => {
  const customFields = Object.keys(record)
    .filter(f => isCustomField(f, 'company'))
    .reduce((obj, key) => ({ ...obj, [key]: record[key] }), {});
  const filteredRecord = Object.keys(record)
    .filter(f => !isCustomField(f, 'company'))
    .reduce((obj, key) => ({ ...obj, [key]: record[key] }), {});

  const uploadRecord = { customFields, ...filteredRecord };
  return axios.post('https://canny.io/api/v1/companies/update', {
    apiKey: process.env.CANNY_API_KEY,
    ...uploadRecord
  });
}

const CANNY_OBJECTS = {
  company: {
    label: "Companies",
    can_create_fields: "on_write",
    updateHandler: (record) => {
      updateCompanyRecord(record);
    },
    fields: [
      {
        field_api_name: "id",
        label: "Company ID",
        identifier: true,
        updateable: false,
        type: "string",
        required: true,
        array: false,
      },
      {
        field_api_name: "name",
        label: "Name",
        type: "string",
        required: true,
      },
      {
        field_api_name: "created",
        label: "Created Date",
        type: "date_time",
      },
      {
        field_api_name: "monthlySpend",
        label: "MRR (in dollars)",
        type: "float"
      }
    ]
  },
  user: {
    label: "Users",
    can_create_fields: "on_write",
    upsertHandler: (record) => {
      upsertUserRecord(record);
    },
    updateHandler: async (record) => {
      // this not an efficient implementation!
      // 1. check whether record is present, if it isn't, return with skip result
      // 2. if present, call upsert/insert handler

      function findByEmail(email) {
        return axios.post('https://canny.io/api/v1/users/retrieve', {
          apiKey: process.env.CANNY_API_KEY,
          email
        });
      }
    
      function findByUserID(userID) {
        return axios.post('https://canny.io/api/v1/users/retrieve', {
          apiKey: process.env.CANNY_API_KEY,
          userID
        });
      }

      const lookupResults = await Promise.allSettled(
        [findByEmail(record.email), findByUserID(record.userID)]
      );
      const recordFound = lookupResults.some(res => res.status == 'fulfilled' && res.value.status == 200);
      
      if (recordFound) {
        upsertUserRecord(record);
      } else {
        throw new Error("Record not present");
      }
    },
    fields: [
      {
        field_api_name: "userID",
        label: "User ID",
        identifier: true,
        updateable: false,
        type: "string",
        required: true,
        array: false,
      },
      {
        field_api_name: "name",
        label: "Name",
        type: "string",
        required: true,
      },
      {
        field_api_name: "companies",
        label: "Companies",
        type: "string",
        array: true,
      },
      {
        field_api_name: "avatarURL",
        label: "Avatar URL",
        type: "string",
      },
      {
        field_api_name: "created",
        label: "Created Date",
        type: "date_time"
      },
      {
        field_api_name: "email",
        label: "Email",
        type: "string"
      }
    ]
  }
}

const isAuthenticatedRequest = (request) => {
  return request.queryStringParameters?.census_secret === process.env.CENSUS_SECRET;
}

exports.handler = async function(event, context) { 
  // ensure that this request is authenticated via shared secret
  // passed in as a url parameter: your-endpoint/?census_secret=<YOUR SECRET>
  // recommended steps to follow:
  //  1. generate and save the secret in a password manager
  //  2. add it to the environment as an variable called CENSUS_SECRET
  //  3. add it to the custom URL in the Census configuration
  if (!isAuthenticatedRequest(event)) {
    return {
      statusCode: 401,
      body: "Invalid request authentication"
    }
  }

  const destination = Destination(CANNY_OBJECTS);
  const requestBodyBuffer = event.body;
  console.log(requestBodyBuffer);
  const { id, method, params } = JSON.parse(requestBodyBuffer);

  const result = await destination[method](params);

  const response = {
    jsonrpc: "2.0",
    id,
    result,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response)
  };
}