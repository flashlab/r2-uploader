<span style="font-size: .8rem">Last updated: 2024-07-01</span>

### Why this tool? 🤔

In May 2022, Cloudflare launched R2 into open beta, a new S3-like object storing platform with generous free tier. It is a great alternative to AWS S3, especially for small projects and personal use. However, Cloudflare dashboard could only upload files smaller than 300MB, which is not ideal for large files. This tool is a simple web interface for R2, which allows you to manage your files in R2 buckets.

### Requirements ☝️

- Cloudflare account
- Cloudflare R2 Subscription (has a free quota)
- Cloudflare Workers Subscription (free plan would be enough)

![](https://r2-cf-api.jw1.dev/dashboard.png)

### Set up the R2 bucket 📦

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. On the left panel, there is a section called "R2". Click on it.
3. Create a new bucket by clicking on the "Create Bucket" button. (You will need to input the bucket name)

And that's it, now we set up the workers.

### Set up the Worker 👷‍♂️

A Worker is like the backend of a website, it allows the R2 Uploader to communicate with the R2 bucket. **This is the most important part of the setup, so please follow the steps carefully.**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. On the left panel, there is a section called "Workers & Pages". Click on it.
3. Click on the "Create Application" button and the click on the "Create Worker" button.
4. So now Cloudflare will automatically generate a name for your Worker, you can either enter a name you like or leave it as it is. Ignore that code preview section, and now click the "Deploy" button.
5. Click on the button "Edit code", now you will see a code editor, delete all the code in it and paste the code  below:

   <details><summary>Expand the code</summary>

   ```js
   var hasValidHeader = (request, env) => {
      return request.headers.get('Authorization') === env.AUTH_KEY_SECRET
   }
   function authorizeRequest(request, env, key) {
      switch (request.method) {
      case 'PUT':
         if (key.length < 1) return false
         return hasValidHeader(request, env)
      case 'DELETE':
         if (key.length < 1) return false
         return hasValidHeader(request, env)
      case 'PATCH':
         return hasValidHeader(request, env)
      case 'GET':
         if (key.length < 1) return false
         return !env.PRIVATE_BUCKET || hasValidHeader(request, env)
      case 'OPTIONS':
         return true
      default:
         return false
      }
   }
   var worker_default = {
      async fetch(request, env) {
      const url = new URL(request.url)
      let key = decodeURIComponent(url.pathname.slice(5))
      let respBody = null
      let respStatus = 200
      if (!authorizeRequest(request, env, key)) {
         return new Response('Forbidden', { status: 403 })
      }
      const headers = new Headers()
      // CORS setup
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Access-Control-Allow-Methods', 'PUT, PATCH, GET, DELETE, OPTIONS')
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      headers.set('Access-Control-Expose-Headers', 'Content-Location')
      try {
         switch (request.method) {
            case 'PUT':
            let file = await env.R2_BUCKET.head(key);
            if (file && url.searchParams.get('force') == null) {
               if (url.searchParams.get('rename') != null) {
                  const dot = key.lastIndexOf('.')
                  if (dot == -1) key += '_'
                  else key = key.substring(0, dot) + '_' + key.substring(dot)
                  file = await env.R2_BUCKET.head(key)
               }
               if (file) {
                  respBody = 'File already exists!'
                  respStatus = 409
                  break
               }
            }
            const saved = await env.R2_BUCKET.put(key, request.body, {
               httpMetadata: {
                  contentType: request.headers.get('Content-Type') || '',
                  cacheControl: 'public, max-age=604800'
               }
            })
            if (saved) {
               headers.set('Content-Location', encodeURIComponent(key))
               respStatus = 201
            }
            break
            case 'PATCH':
            headers.set('Content-Type', 'application/json')
            respBody = JSON.stringify(await env.R2_BUCKET.list())
            break
            case 'GET':
            const object = await env.R2_BUCKET.get(key)
            if (object === null) {
               respBody = 'Object Not Found!'
               respStatus = 404
               break
            }
            object.writeHttpMetadata(headers)
            headers.set('etag', object.httpEtag)
            respBody = object.body
            break
            case 'DELETE':
            await env.R2_BUCKET.delete(key)
            respBody = 'Deleted!'
            break
            case 'OPTIONS':
            break
            default:
            respBody = 'Method Not Allowed!'
            respStatus = 405
         }
      } catch (error) {
         return new Response("Internal Server Error", { status: 500 })
      }
      return new Response(respBody, {
         headers: headers,
         status: respStatus
      })
      }
   }
   export { worker_default as default }
   ```

   </details>
6. Now click on the "Save and Deploy" button, you will see a URL on top of the page, copy it to somewhere like a notepad, **we will need it later**.
7. Go to the worker page, go to the "Settings" and then click the "Variable" on the left side.

   ![](https://r2-cf-api.jw1.dev/r2_page.png)

8. First we focus on the "Environment Variables" section, we need to add a key value pair for the Worker to read as a configuration. Click on the "Add variable" button, and then enter the variable name as "AUTH_KEY_SECRET" and the value is a random string, you can generate one [here](https://www.avast.com/random-password-generator), click "Save and deploy". Remember to save the value somewhere, **we will need it later**.

   ![](https://r2-cf-api.jw1.dev/workers_api_key_setup.png)

9. Now we scroll down to the "R2 Bucket Bindings" section, click on the "Add binding" button, and then enter the variable name as "R2_BUCKET" and the value is the name of the bucket you created earlier, click "Save and deploy".

   ![](https://r2-cf-api.jw1.dev/r2_bindings_to_worker.png)

If you go to the Worker URL now, you will see a "Object Not Found" message, that means the worker is working as expected.

Now we have set up the worker, we can now set up the uploader.

### Set up the Uploader 🗄️

Phew, we've come a long way, now we are going to set up the uploader, which is the web interface for the R2 bucket.

![](https://r2-cf-api.jw1.dev/eFeFgOgn_bXLbpYs.png)

Remember the Worker URL and the random string we saved earlier? We will need them now.

In R2 Uploader, we call the Worker URL as the "Endpoint" and the random string as the "API Key". Enter the Endpoint and the API key, ignore the custom domain for now and click "Save to LocalStorage".

Now you can upload and manage your files in the R2 bucket!

![upload files with the uploader](https://r2-cf-api.jw1.dev/p3eqM3JOpcDfzXdi.png)

<span style="font-size: 2rem">🎉</span>

R2 Uploader **does not** store your Endpoints or API keys in the cloud, it is stored in your browser's LocalStorage, which means it is only accessible by you. All the traffic goes through the Worker and the R2 bucket you just created.

**Note:** We use `showDirectoryPicker` API to make the folder upload possible, if the `Choose Folder` button doesn't show up, it simply means that your browser does not support this API. ([showDirectoryPicker on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker))

### For private use 🔒

At default, the Worker will allow all the GET requests to go through, which means anyone can access your file if they know the URL.

If you want to make your bucket private, you can do so by adding a new variable in the Worker settings.

1. Go to the worker page, go to the "Settings" and then click the "Variable" on the left side.
2. Click on the "Edit variable" and "Add variable" button, then enter the variable name as "PRIVATE_BUCKET" and the value is "true", click "Save and deploy".
   
This will make the Worker to check the `Authorization` header for every request, and only allow the request with the correct API key to go through.

If you want the bucket to be public again, just delete the variable.

### Set up a custom domain 🌐

By default, the Worker URL should be working right away, unless you want the url to be a little bit clean or, you live in China (or maybe some other country). Unfortunately, the domain name `workers.dev` is blocked in China, so we need to set up a custom domain.

Workers and R2 both supports custom domain, and we just need one of them to make the R2 work in China.

**For Workers:**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. On the left panel, there is a section called "Workers & Pages". Click on it.
3. Go to your Worker, click on the "Triggers", you'll see a custom domain section, click on the "Add Custom Domain" button. Input the domain name and you're done!
4. Remember to replace the Endpoint in the R2 Uploader with the custom domain.

**For R2:**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. On the left panel, there is a section called "R2". Click on it.
3. Go to your bucket, click on the "Settings", find "Custom Domains" section, and then click on the "Connect Domain" button. Input the domain name just like you did in the Workers, and you're done!
4. Remember to update the **Custom Domain** in the R2 Uploader with **the R2 custom domain**.

   Attention! This time, instead of changing the Endpoint field in the R2 Uploader, we change the Custom Domain field with the R2 custom domain.

   ![](https://r2-cf-api.jw1.dev/endpoint.png)

This sounds a little bit complicated, let me break it down for you:

- Setting up a custom domain for Workers is the simplest way to work with R2 Uploader

### Hidden features 😜

1. You can copy a file from your system and then paste it into the uploader, it will automatically queue the file and ready to be uploaded.
2. To edit the name of queued files, just click on the file name.
3. Rename the file like `folder/file.txt` will upload the `file.txt` to the folder, you'll get a folder structure in your bucket.

---

Ok now, I think we've covered everything, if you have any questions, feel free to create a new issue under [this repo](https://github.com/jw-12138/r2-uploader/issues).
