<template>
  <div class="font-bold italic">Upload Files</div>
  <div class="drop-zone" @dragover.prevent="handleDragOver" @drop="handleDrop" @paste="handlePaste">
    <span class="text-xs opacity-50">Drag and drop files here or paste files.</span>
    <div>
      <label
for="fileInput"
        class="rounded bg-emerald-200 dark:bg-emerald-800 px-4 py-2 inline-block mt-4 mb-4 cursor-pointer text-sm shadow hover:shadow-xl"
        :style="{
          opacity: uploading ? 0.5 : 1
        }">{{ chooseFileBtnText }}
      </label>

      <label
v-show="browserSupportsDirectoryUpload"
        class="ml-2 rounded bg-emerald-100 dark:bg-emerald-900 px-4 py-2 inline-block mt-4 mb-4 cursor-pointer text-sm shadow hover:shadow-xl"
        :style="{
          opacity: uploading ? 0.5 : 1
        }" @click="handleFolder">Choose Folder 📂</label>

      <input
id="fileInput" type="file" multiple class="absolute left-[-9999rem]" :disabled="uploading"
        @change="handleFilesChange" />
    </div>
  </div>
  <div v-show="fileList.length" class="mt-2">
    <button
class="inline-block w-auto shadow transition-all hover:shadow-xl hover:rounded-3xl" type="button"
      :disabled="uploading" @click="upload">🔥 Upload
    </button>
  </div>
  <div class="text-xs opacity-50 mb-2">
    {{ fileList.length }} File{{ fileList.length === 1 ? '' : 's' }}, {{ parseByteSize(allFileSize) }} total.
    <span v-show="!urlSuffix && !uploading">
      Will skip
      <span v-show="calcSkipFiles() === fileList.length && !uploading">all. </span>
      <span v-show="calcSkipFiles() !== fileList.length">{{ calcSkipFiles() }} file{{ calcSkipFiles() === 1 ? '' : 's'
        }}.
      </span>
    </span>
  </div>

  <div v-show="uploading || uploadedList.length > 0" class="text-center text-xs py-4">
    {{ uploadIsDone ? 'Uploaded' : 'Uploading' }} at
    <span class="dark:text-green-200 text-green-800 italic font-bold">{{ globalSpeed }}</span>
    <span v-show="uploadIsDone">, All done.</span>
  </div>

  <!-- Upload status panel begin -->
  <div v-show="fileList.length > 0 || uploadedList.length > 0" class="pb-4 pt-2">
    <div class="flex flex-wrap dark:bg-neutral-950 bg-neutral-50 pt-2 px-2 pb-1 rounded-xl shadow">
      <div
v-for="item in uploadedList" :key="item.id_key" class="rounded-xl w-[.5rem] h-[.5rem] mb-1 mr-1" :class="[
        statusMap[item.id_key] === 'error' ? 'bg-red-500' :
          statusMap[item.id_key] === 'dup' ? 'bg-amber-500' :
            'bg-green-400 dark:bg-green-600'
      ]">
      </div>
      <div
v-for="item in fileList" :key="item.id_key" 
        class="bg-gray-300 dark:bg-neutral-700 w-[.5rem] h-[.5rem] mb-1 mr-1 relative rounded-xl overflow-hidden">
        <div
class="absolute w-full bottom-0 left-0" style="height: 0" :style="{
          height: progressMap[item.id_key] + '%'
        }" :class="[
                statusMap[item.id_key] === 'error' ? 'bg-red-500' :
                  item.shouldBeSkipped ? 'bg-amber-500' :
                    'bg-green-400 dark:bg-green-600'
              ]">
        </div>
      </div>
    </div>
  </div>
  <div v-show="uploadIsDone" class="text-center">
    <button
      class="inline-block border-0 w-auto text-xs outline dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-300 hover:dark:bg-neutral-700 rounded-3xl"
      style="border: none;" @click="clearUploadedFiles">Dismiss</button>
  </div>
  <div v-show="fileList.length > 0 && !uploading" class="pb-4">
    <div class="mb-2 text-xs">If file with same name pre-exists on server, do</div>
    <div class="flex items-center mb-3 text-xs [&>label]:cursor-pointer [&>label]:!mr-4">
      <input id="c-o-1" v-model="urlSuffix" type="radio" value="">
      <label for="c-o-1">Skip</label>
      <input id="c-o-2" v-model="urlSuffix" type="radio" value="rename">
      <label for="c-o-2">Auto suffix with <code>_</code></label>
      <input id="c-o-3" v-model="urlSuffix" type="radio" value="force">
      <label for="c-o-3">Overwrite</label>
    </div>
    <div class="flex mb-2">
      <input
id="renameFileWithRandomId" v-model="renameFileWithRandomId" type="checkbox" class="text-xs shrink-0"
        :disabled="uploading" />
      <label class="text-xs" for="renameFileWithRandomId">Rename each file with a random ID</label>
    </div>
    <div class="flex">
      <input
id="compressImagesBeforeUploading" v-model="compressImagesBeforeUploading" type="checkbox" class="text-xs shrink-0"
        :disabled="uploading" />
      <label class="text-xs" for="compressImagesBeforeUploading">
        Compress images before uploading
      </label>
    </div>
    <div v-if="compressImagesBeforeUploading" class="text-xs pt-4 pl-2">
      <div>
        <label for="removeEXIF" class="flex items-center"><input
id="removeEXIF" v-model="defaultCompressOptions.removeEXIF"
            type="checkbox"> Remove EXIF</label>
      </div>
      <div class="flex">
        <label for="covertImageType" class="flex items-center">
          <input
id="covertImageType" v-model="defaultCompressOptions.convertImageType" type="checkbox"
            class="shrink-0">
          <span class="shrink-0">Covert to</span>
          <select
v-model="defaultCompressOptions.imageType" :disabled="!defaultCompressOptions.convertImageType"
            class="shrink-0 mb-0 ml-2 text-sm py-1 px-2">
            <option value="jpeg">jpg</option>
            <option value="png">png</option>
            <option value="webp">webp</option>
          </select>
        </label>
      </div>
      <div class="flex">
        <label for="maxWidth" class="flex items-center">
          <span class="shrink-0">Max Width:</span>
          <input
id="maxWidth" v-model="defaultCompressOptions.maxWidth"
            type="number" class="text-xs py-1 px-2 ml-1 mb-0"
            style="margin-bottom: 0; padding: .25rem .25rem; height: auto" placeholder="Infinity">
        </label>
      </div>
      <div class="flex">
        <label for="maxHeight" class="flex items-center">
          <span class="shrink-0">Max Height:</span>
          <input
id="maxHeight" v-model="defaultCompressOptions.maxHeight"
            type="number" class="text-xs py-1 px-2 ml-1 mb-0"
            style="margin-bottom: 0; padding: .25rem .25rem; height: auto" placeholder="Infinity">
        </label>
      </div>
      <div class="flex">
        <label for="quality" class="flex items-center">
          <span class="shrink-0">Image Quality:</span>
          <input
id="quality" v-model="defaultCompressOptions.quality"
            type="number" class="text-xs py-1 px-2 ml-1 mb-0"
            style="margin-bottom: 0; padding: .25rem .25rem; height: auto">
        </label>
      </div>
    </div>
    <div class="flex pt-1 items-center">
      <input
id="uploadToFolder" v-model="uploadToFolder" type="checkbox" class="text-xs shrink-0"
        :disabled="uploading" />
      <label class="text-xs whitespace-nowrap" for="uploadToFolder"> Upload to folder </label>
      <input
v-model="customFolderName" type="text" class="text-xs px-2 py-1"
        style="padding: 0.2rem 0.4rem; margin: 0; height: auto" placeholder="/" @blur="handleFolderNameBlur" />
    </div>
  </div>
  <!-- Files Queued begin -->
  <div v-show="fileList.length" class="pt-4 pb-2 text-xs">
    Files Queued:
  </div>
  <div v-for="item in fileList" :key="item.id_key" class="item rounded text-sm flex w-full mb-2 relative items-center">
    <img class="max-h-14 mr-2" :src="item.url" @load="imgLoad(item, $event)" />
    <div class="w-full bg-neutral-50 text-xs rounded dark:bg-[#333] px-2 py-2 relative shadow">
      <div
class="progress absolute h-[.1rem] bottom-0 left-0 transition-all" :style="{
        width: progressMap[item.id_key] + '%'
      }" :class="[
              statusMap[item.id_key] === 'error' ? 'bg-red-500' :
                item.shouldBeSkipped ? 'bg-amber-500' :
                  'bg-green-400 dark:bg-green-600'
            ]">
      </div>
      <div v-show="editKey === item.id_key" class="flex">
        <form action="javascript:" class="flex mb-0 w-full" @submit="renameThisFile(item)">
          <input
:id="'input_' + item.id_key" class="text-xs w-full" type="text"
            style="padding: 0.2rem 0.4rem; margin: 0; height: auto" :value="renameFileWithRandomId ? item.id_key : item.key" />
          <button
class="ml-2 inline-block w-auto shrink-0 outline text-xs text-emerald-500 mb-0"
            style="padding: 0; border: none; background: transparent" type="submit">Rename
          </button>
          <button
type="button" class="inline-block mb-0 w-auto shrink-0 outline ml-2 dark:text-white text-black text-xs"
            style="padding: 0; border: 0"
            @click="editKey = null">Cancel
          </button>
        </form>
      </div>
      <span
v-show="editKey !== item.id_key"
        :data-tooltip="statusMap[item.id_key] === 'uploading' ? 'Can\'t rename now' : 'Click to rename'" class="inline-block break-all"
        @click="showRenameInput(item.id_key, statusMap[item.id_key])">{{ renameFileWithRandomId ? item.id_key
        : item.key }}
      </span><br />
      <span
:style="{
        marginTop: editKey === item.id_key ? '0' : '0.25rem',
        top: editKey !== item.id_key ? 0 : '-.2rem'
      }" class="opacity-80 mt-1 inline-block relative font-mono" :class="[
                statusMap[item.id_key] === 'error' ? 'text-red-500' :
                  item.shouldBeSkipped ? 'text-amber-500' :
                    'text-green-400 dark:text-green-600'
              ]">{{ parseByteSize(item.size) }}
        <span v-show="uploading && statusMap[item.id_key] !== 'compressing'"> / {{ progressMap[item.id_key] }}%</span>
        <span v-show="statusMap[item.id_key] === 'compressing'">Compressing...</span>
        <span v-show="statusMap[item.id_key] === 'splitting' && item.isMpu">Splitting Chunks...</span>
      </span>
    </div>
    <div
v-show="editKey !== item.id_key" class="rounded text0-xs px-2 cursor-pointer hover:text-red-500"
      @click="removeThisFile(item)">
      <i class="iconfont icon-error"></i>
    </div>
    <div
v-show="statusMap[item.id_key] !== 'uploading'" title="Re-Upload this file"
      class="rounded text0-xs px-2 cursor-pointer" @click="reUploadThisFile(item)">
      <i class="iconfont icon-reload"></i>
    </div>
  </div>
  <!-- Files Queued end -->
  <!-- Uploaded List begin -->
  <div v-show="uploadedList.length" class="pt-4 pb-2 text-xs">
    Uploaded List:
  </div>
  <div
v-for="item in uploadedList" :key="item.id_key"
    class="item rounded text-sm flex w-full mb-2 relative items-center">
    <img class="max-h-14 mr-2" :src="item.url" />
    <div class="w-full bg-neutral-50 text-xs rounded dark:bg-[#333] px-2 py-2 relative shadow">
      <div
class="progress absolute h-[.1rem] bottom-0 left-0 transition-all" :style="{
        width: progressMap[item.id_key] + '%'
      }" :class="[
              statusMap[item.id_key] === 'error' ? 'bg-red-500' :
                statusMap[item.id_key] === 'dup' ? 'bg-amber-500' :
                  'bg-green-400 dark:bg-green-600'
            ]"></div>
      <div v-show="editKey === item.id_key" class="flex">
        <form action="javascript:" class="flex mb-0 w-full" @submit="renameThisFile(item)">
          <input
:id="'input_' + item.id_key" class="text-xs w-full" type="text"
            style="padding: 0.2rem 0.4rem; margin: 0; height: auto" :value="renameFileWithRandomId ? item.id_key : item.key" />
          <button
class="ml-2 inline-block w-auto shrink-0 outline text-xs text-emerald-500 mb-0"
            style="padding: 0; border: none; background: transparent" type="submit">Rename
          </button>
          <button
type="button" class="inline-block mb-0 w-auto shrink-0 outline ml-2 dark:text-white text-black text-xs"
            style="padding: 0; border: 0"
            @click="editKey = null">Cancel
          </button>
        </form>
      </div>
      <span
v-show="editKey !== item.id_key" :data-tooltip="uploading ? 'Can\'t rename now' : 'Click to rename'"
        class="inline-block break-all" @click="showRenameInput(item.id_key, statusMap[item.id_key])">{{
        renameFileWithRandomId ? item.id_key
        : item.key }}</span><br /><span
:style="{
          marginTop: editKey === item.id_key ? '0' : '0.25rem',
          top: editKey !== item.id_key ? 0 : '-.2rem'
        }" class="opacity-80 mt-1 inline-block relative font-mono" :class="[
                statusMap[item.id_key] === 'dup' ? 'text-amber-500' :
                  'text-green-400 dark:text-green-600'
            ]">{{ parseByteSize(item.size) }} <a
          :href="customDomain + (renameFileWithRandomId ? item.id_key : item.key) + dimensionMap[item.url]">dimension
        </a>
        <a :href="endPoint + (renameFileWithRandomId ? item.id_key : item.key)" target="_blank">preview</a>
        <span v-show="uploading && statusMap[item.id_key] !== 'compressing'"> / {{ progressMap[item.id_key] }}%</span>
        <span v-show="statusMap[item.id_key] === 'compressing'">Compressing...</span></span>
    </div>
    <div
v-show="editKey !== item.id_key" class="rounded text0-xs px-2 cursor-pointer hover:text-red-500"
      @click="removeThisFile(item)">
      <i class="iconfont icon-error"></i>
    </div>
    <div
v-show="statusMap[item.id_key] !== 'uploading'" title="Re-Upload this file"
      class="rounded text0-xs px-2 cursor-pointer" @click="reUploadThisFile(item)">
      <i class="iconfont icon-reload"></i>
    </div>
  </div>
  <!-- Uploaded List end -->
</template>

<script setup>
import { reactive, ref, watch, onMounted } from 'vue'
import axios from 'axios'
import { useStatusStore } from '../store/status'
import { nanoid } from 'nanoid'
import Compressor from 'compressorjs'
import { storeToRefs } from 'pinia'

let statusStore = useStatusStore()

let browserSupportsDirectoryUpload = ref(true)
let fileList = ref([])
let chooseFileBtnText = ref('Choose Files')
let allFileSize = ref(0)
let progressMap = ref({})
let dimensionMap = ref({})
let statusMap = ref({})
let abortControllerMap = ref({})
let uploading = ref(false)
let uploadIsDone = ref(false)

let realTimeSpeedRecords = ref({})

let editKey = ref('')
let urlSuffix = ref('')
let renameFileWithRandomId = ref(false)
let compressImagesBeforeUploading = ref(false)
let uploadToFolder = ref(false)
let customFolderName = ref('')
let endPoint = ref(localStorage.getItem('endPoint'))
let customDomain = ref(localStorage.getItem('customDomain') || endPoint)
let { endPointUpdated } = storeToRefs(statusStore)

let clearUploadedFiles = function () {
  uploadedList.value = []
  progressMap.value = {}
  dimensionMap.value = {}
  statusMap.value = {}
  abortControllerMap.value = {}
  fileList.value = []
  uploadIsDone.value = false
}

let defaultCompressOptions = reactive({
  quality: 0.9,
  removeEXIF: true,
  convertImageType: true,
  imageType: 'webp',
  maxWidth: '',
  maxHeight: ''
})

watch(endPointUpdated, () => {
  endPoint.value = localStorage.getItem('endPoint')
  customDomain.value = localStorage.getItem('customDomain') || endPoint
})

watch(defaultCompressOptions, function (val) {
  localStorage.setItem('defaultCompressOptions', JSON.stringify(val))
})

onMounted(() => {
  let defaultCompressOptionsStr = localStorage.getItem('defaultCompressOptions')
  if (defaultCompressOptionsStr) {
    try {
      let config = JSON.parse(defaultCompressOptionsStr)

      defaultCompressOptions.quality = config.quality
      defaultCompressOptions.removeEXIF = config.removeEXIF
      defaultCompressOptions.convertImageType = config.convertImageType
      defaultCompressOptions.imageType = config.imageType
      defaultCompressOptions.maxWidth = config.maxWidth
      defaultCompressOptions.maxHeight = config.maxHeight
    } catch (e) {
      console.log(e)
    }
  }
})

let compressImage = async function (file) {
  const allowedType = 'image/'

  if (file.type.startsWith(allowedType) === false) {
    return file
  }

  return new Promise((resolve, reject) => {

    new Compressor(file, {
      quality: 0.8,
      convertSize: Infinity,
      retainExif: !defaultCompressOptions.removeEXIF,
      mimeType: defaultCompressOptions.convertImageType ? 'image/' + defaultCompressOptions.imageType : 'auto',
      maxWidth: defaultCompressOptions.maxWidth ? defaultCompressOptions.maxWidth : undefined,
      maxHeight: defaultCompressOptions.maxHeight ? defaultCompressOptions.maxHeight : undefined,
      success(result) {
        // result is a blob, convert it into a file
        let newFile = new File([result], result.name, {
          type: result.type
        })

        let extension = newFile.name.split('.').pop()
        newFile.id_key = file.id_key.split('.').shift() + '.' + extension
        newFile.key = file.key.split('.').shift() + '.' + extension
        newFile.url = file.url

        console.log(`compressed ${file.name} from ${parseByteSize(file.size)} to ${parseByteSize(newFile.size)}`)
        resolve(newFile)
      },
      error(err) {
        reject(err)
      }
    })
  })
}

let calcSkipFiles = function () {
  return fileList.value.filter((item) => item.shouldBeSkipped).length
}

let calcUploadSpeed = function (bytes, time_ms) {
  return parseByteSize((bytes / time_ms) * 1000) + '/s'
}

let parseByteSize = function (size) {
  let units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  let index = 0
  while (size > 1000) {
    size /= 1000
    index++
  }
  return `${size.toFixed(2)} ${units[index]}`
}

try {
  showDirectoryPicker
  console.log('browser supports directory upload')
} catch (e) {
  browserSupportsDirectoryUpload.value = false
}

let updateFileSkipProperty = function () {
  const seen = new Set();
  fileList.value.forEach(file => {
    if (seen.has(file.key) && !renameFileWithRandomId.value && !urlSuffix.value) {
      file.shouldBeSkipped = true;  // Mark as duplicate (not first occurrence)
    } else {
      file.shouldBeSkipped = false; // Mark as first occurrence
      seen.add(file.key);
    }
  });
}

let removeThisFile = function (file) {
  const filename = renameFileWithRandomId.value ? file.id_key : file.key
  const isUploaded = uploadedList.value.some((el) => el.id_key === file.id_key)
  if (!isUploaded) {
    abortControllerMap.value[file.id_key]?.abort()
    fileList.value = fileList.value.filter((item) => item.id_key !== file.id_key)
    doneUploadingCleanUp()
  } else {
    const { url, apiKey, err } = generateUri(file)
    if (err || !confirm(`Are you sure to remove ${filename} from REMOTE server?`)) return
    axios({
      method: 'delete',
      headers: {
        'Authorization': apiKey
      },
      url: url
    })
      .then(() => {
        uploadedList.value = uploadedList.value.filter((item) => item.id_key !== file.id_key)
      })
      .catch(() => {
        alert(`Failed to delete ${filename}.`)
      })
  }
}

let reUploadThisFile = function (file) {
  if (confirm('Are you sure to re-upload this file?')) {
    const isUploaded = uploadedList.value.some((el) => el.id_key === file.id_key)
    if (isUploaded) {
      uploadedList.value = uploadedList.value.filter((item) => item.id_key !== file.id_key)
      if (fileList.value.findIndex((el) => el.id_key === file.id_key) === -1) fileList.value.push(file)
    }
    uploadFile(file)
  }
}

let renameThisFile = function (file) {
  const isUploaded = uploadedList.value.some((el) => el.id_key === file.id_key)
  let newName = document.getElementById('input_' + file.id_key).value
              .trim().replace(/[\\/:"*?<>|]/g, ''); // Remove illegal characters
  if (!newName) return false;
  if (renameFileWithRandomId.value) {
    if (newName === file.id_key) {
      editKey.value = ''
      return false
    }

    let match = fileList.value.findIndex((el) => el.id_key === newName)
    if (match === -1) match = uploadedList.value.findIndex((el) => el.id_key === newName)

    if (match !== -1) {
      alert('File with the same id already exists.')
      return false
    }

    file.id_key = newName
    editKey.value = ''
  } else {
    if (newName === file.key) {
      editKey.value = ''
      return false
    }
    file.key = newName
    editKey.value = ''
  }
  if (isUploaded && confirm('Upload and force rename?')) {
    urlSuffix.value = 'force'
    reUploadThisFile(file)
  }
}

let showRenameInput = function (key, status) {
  if (status == 'uploading') {
    return false
  }
  editKey.value = key
}

let genImagePreview = function (ext, file) {
  file.url = ['jpg', 'jpeg', 'gif', 'png', 'webp', 'bmp'].includes(ext.toLowerCase()) ?
    URL.createObjectURL(file) : 'https://weavatar.com/avatar/84f99bb682f6cc6d69915e5f1c16ae0c?d=letter&letter=' + ext
}

let handleFolder = async function () {
  uploadedList.value = []
  const files = []
  const dirHandle = await showDirectoryPicker()
  const dirName = dirHandle.name
  await handleDirectoryEntry_v2(dirHandle, '', files)

  files.forEach((file) => {
    file.key = dirName + file.key

    // get extension
    let extension = file.name.split('.').pop()

    // get sub-folder str
    let subFolderArr = file.key.split('/')
    subFolderArr.pop()

    let subFolderStr = subFolderArr.join('/')

    file.id_key = subFolderStr + '/' + nanoid(16) + '.' + extension
    genImagePreview(extension, file)

    fileList.value.push(file)
  })
}

async function handleDirectoryEntry_v2(dirHandle, basePath, files) {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      let file = await entry.getFile()
      let separator = '/'

      file['key'] = basePath + separator + entry.name
      files.push(file)
    }

    if (entry.kind === 'directory') {
      await handleDirectoryEntry_v2(entry, basePath + '/' + entry.name, files)
    }
  }
}

let generateUri = function (file) {
  const apiKey = localStorage.getItem('apiKey')
  let url = null
  let err = false

  if (!endPoint.value || !apiKey) {
    err = true
    alert('Please set an endpoint and api key first.')
  } else {
    let file_key = renameFileWithRandomId.value ? file.id_key : file.key
    url = endPoint.value + file_key
  }
  return {
    url: url,
    apiKey: apiKey,
    err: err
  }
}

let handleFolderNameBlur = function () {
  if (!uploadToFolder.value || !customFolderName.value || fileList.value.length === 0) {
    return
  }

  if (customFolderName.value === '/') {
    customFolderName.value = ''
    return
  }

  let folderPath = customFolderName.value.replace(/^\/+/, '')
  
  // Normalize folder path to ensure it ends with /
  if (folderPath && !folderPath.endsWith('/')) {
    folderPath = folderPath + '/'
  }
  customFolderName.value = folderPath

  fileList.value = fileList.value.map(file => {
    let fileName = file.key.split('/').pop()
    let idFileName = file.id_key.split('/').pop()

    file.key = folderPath + fileName
    file.id_key = folderPath + idFileName

    return file
  })

  // Update skip properties if needed
  if (skipFilesWithTheSameName.value) {
    updateFileSkipProperty()
  }
}

function handleFilesChange(e) {
  const files = e.target.files || e.dataTransfer?.files || e.clipboardData?.files
  if (files && files.length > 0) return handleFiles(files)
}

function handlePaste(e) {
  const files = e.clipboardData?.files
  if (files && files.length !== 0) return handleFiles(files);
}

function handleDragOver(event) {
  // Allow the drop by preventing the default behavior
  event.preventDefault();
};

function handleDrop(event) {
  event.preventDefault(); // Prevent default browser behavior for dropped files
  const files = event.dataTransfer.files;
  if (files && files.length > 0) return handleFiles(files);
};

let handleFiles = function (files) {
  // uploadedList.value = []
  // progressMap.value = {}
  // statusMap.value = {}
  // abortControllerMap.value = {}

  Array.from(files).forEach((file) => {
    // If uploadToFolder, prepend it to the file path
    if (uploadToFolder.value && customFolderName.value) {
      let folderPath = customFolderName.value
      if (!folderPath.endsWith('/')) {
        folderPath = folderPath + '/'
      }
      file.key = folderPath + file.name
    } else {
      file.key = file.name
    }
    // get extension
    let extension = file.name.split('.').pop()
    // If we have a folder path, include it in the id_key as well
    if (uploadToFolder.value && customFolderName.value) {
      let folderPath = customFolderName.value
      if (!folderPath.endsWith('/')) {
        folderPath = folderPath + '/'
      }
      file.id_key = folderPath + nanoid(16) + '.' + extension
    } else {
      file.id_key = nanoid(16) + '.' + extension
    }
    statusMap[file.id_key] = 'readytouupload'
    genImagePreview(extension, file)
  })
  fileList.value = [...fileList.value, ...Array.from(files)]
  updateFileSkipProperty()
}

let imgLoad = function (file, e) {
  dimensionMap.value[file.url] = `?size=${e.target.naturalWidth}x${e.target.naturalHeight}`
}

let calcAllFileSize = function () {
  allFileSize.value = fileList.value.reduce((prev, curr) => {
    return prev + curr.size
  }, 0)
}

let doneUploadingCleanUp = function () {
  if (fileList.value.length === 0) {
    uploadIsDone.value = true
    uploading.value = false
    statusStore.uploading = false

    document.getElementById('fileInput').value = ''
  }
}

const uploadedList = ref([])
const upload = function () {
  realTimeSpeedRecords.value = {}

  fileList.value.forEach(async (file, index) => {
    if (file.shouldBeSkipped) return false

    if (compressImagesBeforeUploading.value) {
      statusMap[file.id_key] = 'compressing'
      fileList.value[index] = await compressImage(file)
      statusMap[file.id_key] = 'readytouupload'
      uploadFile(fileList.value[index])
      return false
    }
    uploadFile(file)
  })
}

function uploadFile(file) {
  const { url, apiKey, err } = generateUri(file)
  if (err) return false
  uploading.value = true
  statusStore.uploading = true
  uploadIsDone.value = false
  progressMap.value[file.id_key] = 0
  abortControllerMap.value[file.id_key] = new AbortController()
  statusMap.value[file.id_key] = 'uploading'

  file.startUploadingTime = new Date().getTime()

  realTimeSpeedRecords.value[file.id_key] = [
    {
      time: new Date().getTime(),
      loaded: 0
    }
  ]

  if (file.size > 1024 * 1024 * 95) {
    mpuUploadFile(file, apiKey)
    return false
  }

  axios({
    method: 'put',
    url: url + urlSuffix.value,
    headers: {
      'Authorization': apiKey,
      'Content-Type': file.type
    },
    signal: abortControllerMap.value[file.id_key].signal,
    data: file,
    onUploadProgress(event) {
      progressMap.value[file.id_key] = ((100 * event.loaded) / event.total).toFixed(1)

      realTimeSpeedRecords.value[file.id_key].push({
        time: new Date().getTime(),
        loaded: event.loaded
      })
    }
  })
    .then((res) => {
      statusMap.value[file.id_key] = 'done'
      const key = decodeURIComponent(res.headers['content-location'])
      if (key && key != file.key) file.key = key
      file.endUploadingTime = new Date().getTime()
      file.uploadUsedTime = file.endUploadingTime - file.startUploadingTime
      file.uploadSpeed = calcUploadSpeed(file.size, file.uploadUsedTime)
    })
    .catch((e) => {
      if (e.response && e.response.status == 409) {
        statusMap.value[file.id_key] = 'dup'
        uploadedList.value.push(file)
      } else statusMap.value[file.id_key] = 'error'
    })
    .finally(() => {
      if (statusMap.value[file.id_key] !== 'error') {
        if (uploadedList.value.findIndex((el) => el.id_key === file.id_key) === -1) uploadedList.value.push(file)
        fileList.value = fileList.value.filter((item) => item.id_key !== file.id_key)
      }
      progressMap.value[file.id_key] = 100
      doneUploadingCleanUp()
    })
}

async function remoteSupportMpu() {
  try {
    await axios.get(endPoint.value + 'support_mpu')
    return true
  } catch (e) {
    return false
  }
}

async function mpuUploadFile(file, apiKey) {
  console.log(`file size is ${file.size}, switching to mpu`)

  const fileName = renameFileWithRandomId.value ? file.id_key : file.key
  file['isMpu'] = true

  let remoteSupport = await remoteSupportMpu(endPoint.value)

  if (!remoteSupport) {
    alert(
      `R2 workers has refactored its code to support big file uploading, please see the new setup guide at https://r2.jw1.dev/setup-guide`
    )
    return false
  }

  let {data} = await axios({
    method: 'post',
    url: endPoint.value + 'mpu/create/' + fileName,
    headers: {
      'x-api-key': apiKey
    }
  })
  let uploadId = data.uploadId

  const partSize = 1024 * 1024 * 10
  const predictedParts = Math.ceil(file.size / partSize)
  const parts = []
  const maxThreads = 5
  const completedParts = []
  const activePartsSpeed = {}

  let totalLoaded = 0
  let activeThreadCount = 0

  abortControllerMap.value[file.id_key] = []

  let split_i = 0

  async function _splitFileParts(_file, start, end) {
    const part = _file.slice(start, end)
    parts.push(part)
  }

  statusMap.value[file.id_key] = 'splitting'
  while (parts.length < predictedParts) {
    const start = split_i * partSize
    const end = Math.min(file.size, (split_i + 1) * partSize)

    await _splitFileParts(file, start, end)
    split_i++
  }
  statusMap.value[file.id_key] = 'uploading'

  let _s = setInterval(function () {
    if (completedParts.length === parts.length || file.aborted) {
      clearInterval(_s)
      return false
    }

    realTimeSpeedRecords.value[file.id_key].push({
      time: new Date().getTime(),
      loaded: totalLoaded
    })

    file['mpuParts'] = parts.length
    file['mpuDoneParts'] = completedParts.length

    progressMap.value[file.id_key] = ((totalLoaded / file.size) * 100).toFixed(1)
  }, 100)

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i]
    let partNumber = i + 1

    if (file.aborted === true) {
      setTimeout(async function () {
        await axios({
          method: 'delete',
          url: endPoint.value + 'mpu/' + filename + '?' + `uploadId=${uploadId}`,
          headers: {
            'x-api-key': apiKey
          }
        })
      }, 500)
      break
    }

    // threads full, wait here
    if (activeThreadCount >= maxThreads) {
      await new Promise((resolve) => setTimeout(resolve, 30))
      i--
      continue
    }

    // do not use await here
    uploadParts({
      part,
      partNumber
    })

    activeThreadCount++
  }

  async function uploadParts(_p, retryLeft = 5) {
    if (retryLeft === 0) {
      statusMap.value[file.id_key] = 'error'

      abortControllerMap.value[file.id_key].forEach((s) => {
        try {
          s.abort()
        } catch (_) {}
      })

      file.uploading = false
      file['mpuParts'] = 0
      file['mpuDoneParts'] = 0

      clearInterval(_s)
      return false
    }

    let part = _p.part
    let partNumber = _p.partNumber

    if (!activePartsSpeed[partNumber]) {
      activePartsSpeed[partNumber] = []
    }

    abortControllerMap.value[file.id_key][partNumber] = new AbortController()

    let res

    try {
      res = await axios({
        method: 'put',
        url: endPoint.value + 'mpu/' + fileName + '?' + `uploadId=${uploadId}&partNumber=${partNumber}`,
        headers: {
          'x-api-key': apiKey,
          'content-type': file.type
        },
        signal: abortControllerMap.value[file.id_key][partNumber].signal,
        data: part,
        onUploadProgress: function (event) {
          totalLoaded += event.bytes
        }
      })
    } catch (e) {
      setTimeout(async function () {
        await uploadParts(_p, retryLeft - 1)
      }, 500)
      return false
    }

    // release the thread
    activeThreadCount--

    completedParts.push({
      partNumber,
      etag: res.data.etag
    })

    // remove abort signal
    abortControllerMap.value[file.id_key][partNumber] = null

    if (completedParts.length === parts.length) {
      axios({
        method: 'post',
        url: endPoint.value + 'mpu/complete/' + fileName + '?' + `uploadId=${uploadId}`,
        headers: {
          'x-api-key': apiKey
        },
        data: {
          parts
        }
      }).then((res) => {
        statusMap.value[file.id_key] = 'done'
        const key = decodeURIComponent(res.headers['content-location'])
        if (key && key != file.key) file.key = key
        file.endUploadingTime = new Date().getTime()
        file.uploadUsedTime = file.endUploadingTime - file.startUploadingTime
        file.uploadSpeed = calcUploadSpeed(file.size, file.uploadUsedTime)
      })
      .catch((e) => {
        if (e.response && e.response.status == 409) {
          statusMap.value[file.id_key] = 'dup'
          uploadedList.value.push(file)
        } else statusMap.value[file.id_key] = 'error'
      })
      .finally(() => {
        if (statusMap.value[file.id_key] !== 'error') {
          if (uploadedList.value.findIndex((el) => el.id_key === file.id_key) === -1) uploadedList.value.push(file)
          fileList.value = fileList.value.filter((item) => item.id_key !== file.id_key)
        }
        progressMap.value[file.id_key] = 100
        doneUploadingCleanUp()
      })
    }
  }
}

let globalSpeed = ref('0B /s')
setInterval(function () {
  let keys = Object.keys(realTimeSpeedRecords.value)

  let speedMap = {}

  keys.forEach((key) => {
    let records = realTimeSpeedRecords.value[key]
    let last2Records = records.slice(-2)
    let lastRecord = last2Records[last2Records.length - 1]
    let firstRecord = last2Records[0]

    if (!lastRecord) {
      return false
    }

    let timeDiff = lastRecord.time - firstRecord.time
    let loadedDiff = lastRecord.loaded - firstRecord.loaded

    if (timeDiff === 0) {
      return false
    }

    speedMap[key] = (loadedDiff / timeDiff) * 1000 // bytes / s
  })

  let totalSpeed = 0
  let speedMapKeys = Object.keys(speedMap)

  speedMapKeys.forEach((key) => {
    totalSpeed += speedMap[key]
  })

  globalSpeed.value = parseByteSize(totalSpeed) + '/s'
}, 500)

watch(
  fileList,
  (newVal) => {
    if (newVal.length) {
      chooseFileBtnText.value = 'Add More Files'
    } else {
      chooseFileBtnText.value = 'Choose Files'
    }

    calcAllFileSize()
  },
  {
    deep: true
  }
)

// Add watch handler for uploadToFolder
watch(uploadToFolder, (newVal) => {
  if (!newVal) {
    // When unchecked, remove folder path from all files
    fileList.value = fileList.value.map(file => {
      // Get just the filename without any path
      let fileName = file.key.split('/').pop()
      let idFileName = file.id_key.split('/').pop()

      file.key = fileName
      file.id_key = idFileName

      return file
    })
  } else if (customFolderName.value && customFolderName.value !== '/') {
    // When checked and there's a custom folder name, apply it
    let folderPath = customFolderName.value
    if (!folderPath.endsWith('/')) {
      folderPath = folderPath + '/'
    }
    customFolderName.value = folderPath

    fileList.value = fileList.value.map(file => {
      // Get just the filename without any path
      let fileName = file.key.split('/').pop()
      let idFileName = file.id_key.split('/').pop()

      // Update both key and id_key with new folder path
      file.key = folderPath + fileName
      file.id_key = folderPath + idFileName

      return file
    })
  }

  // Update skip properties if needed
  if (skipFilesWithTheSameName.value) {
    updateFileSkipProperty()
  }
})

watch([urlSuffix, renameFileWithRandomId], updateFileSkipProperty);
</script>
