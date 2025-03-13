<template>
  <div>
    <form action="javascript:">
      <div class="font-bold italic">Upload Files</div>
      <div>
        <label for="fileInput"
          class="rounded bg-emerald-200 dark:bg-emerald-800 px-4 py-2 inline-block mt-4 mb-4 cursor-pointer text-sm shadow hover:shadow-xl"
          :style="{
            opacity: uploading ? 0.5 : 1
          }">{{ chooseFileBtnText }}
        </label>

        <label v-show="browserSupportsDirectoryUpload"
          class="ml-2 rounded bg-emerald-100 dark:bg-emerald-900 px-4 py-2 inline-block mt-4 mb-4 cursor-pointer text-sm shadow hover:shadow-xl"
          :style="{
            opacity: uploading ? 0.5 : 1
          }" @click="handleFolder">Choose Folder 📂</label>

        <input id="fileInput" type="file" @change="handleFilesChange" multiple class="absolute left-[-9999rem]"
          :disabled="uploading" />
      </div>
      <div class="mt-2" v-show="fileList.length">
        <button class="inline-block w-auto shadow transition-all hover:shadow-xl hover:rounded-3xl" type="button"
          @click="upload" :disabled="uploading">🔥 Upload
        </button>
      </div>
      <div>
        <div class="text-xs opacity-50 mb-2">
          {{ fileList.length }} File{{ fileList.length === 1 ? '' : 's' }}, {{ parseByteSize(allFileSize) }} total.
          <span v-show="skipFilesWithTheSameName && !uploading">
            Will skip
            <span v-show="calcSkipFiles() === fileList.length && !uploading">all. </span>
            <span v-show="calcSkipFiles() !== fileList.length">{{ calcSkipFiles() }} file{{ calcSkipFiles() === 1 ? '' : 's' }}.
            </span>
          </span>
        </div>
        <div v-show="fileList.length + uploadedList.length > 0">
          <div class="text-center text-xs py-4" v-show="uploading || uploadedList.length > 0">
            {{ uploadIsDone ? 'Uploaded' : 'Uploading' }} at
            <span class="dark:text-green-200 text-green-800 italic font-bold">{{ globalSpeed }}</span>
            <span v-show="uploadIsDone">, All done.</span>
          </div>
        </div>

        <div v-show="fileList.length + uploadedList.length > 0" class="pb-4 pt-2">
          <!--          upload status map -->
          <div class="flex flex-wrap dark:bg-neutral-950 bg-neutral-50 pt-2 px-2 pb-1 rounded-xl shadow">
            <div v-for="item in uploadedList" class="bg-green-400 rounded-xl w-[.5rem] h-[.5rem] mb-1 mr-1">
            </div>
            <div v-for="item in fileList"
              class="bg-gray-300 dark:bg-neutral-700 w-[.5rem] h-[.5rem] mb-1 mr-1 relative rounded-xl overflow-hidden">
              <div class="absolute w-full bottom-0 left-0" style="height: 0" :style="{
                  height: progressMap[item.key] + '%'
                }" :class="[
              statusMap[item.key] === 'error' ? 'bg-red-500' :
              statusMap[item.key] === 'dup' ? 'bg-amber-500' :
              'bg-green-400 dark:bg-green-600'
            ]"></div>
            </div>
          </div>
        </div>
        <div v-show="uploadIsDone" class="text-center">
          <button
            class="inline-block border-0 w-auto text-xs outline dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-300 hover:dark:bg-neutral-700 rounded-3xl"
            style="border: none;" @click="clearUploadedFiles">Dismiss</button>
        </div>
        <div class="pb-4" v-show="fileList.length > 0 && !uploading">
          <div class="mb-2 text-xs">If file with same name pre-exists on server, do</div>
          <div class="flex mb-3 text-xs">
            <div class="flex items-center me-4">
              <input checked id="c-o-1" type="radio" value="" name="conflict-option" @change="updateConflictBehave($event)">
              <label for="c-o-1">Skip</label>
            </div>
            <div class="flex items-center me-4">
              <input id="c-o-2" type="radio" value="rename" name="conflict-option" @change="updateConflictBehave($event)">
              <label for="c-o-2">Auto suffix with <code>_</code></label>
            </div>
            <div class="flex items-center me-4">
              <input id="c-o-3" type="radio" value="force" name="conflict-option" @change="updateConflictBehave($event)">
              <label for="c-o-3">Overwrite</label>
            </div>
          </div>
          <div v-if="false" class="flex mb-2">
            <input :disabled="uploading" class="text-xs shrink-0" type="checkbox"
              id="skip_uploading_if_filename_is_the_same" v-model="skipFilesWithTheSameName" />
            <label for="skip_uploading_if_filename_is_the_same" class="text-xs">Skip uploading files with the same
              name</label>
          </div>
          <div class="flex mb-2">
            <input type="checkbox" class="text-xs shrink-0" :disabled="uploading" v-model="renameFileWithRandomId"
              id="renameFileWithRandomId" />
            <label class="text-xs" for="renameFileWithRandomId">Rename each file with a random ID</label>
          </div>
          <div class="flex">
            <input type="checkbox" class="text-xs shrink-0" :disabled="uploading"
              v-model="compressImagesBeforeUploading" id="compressImagesBeforeUploading" />
            <label class="text-xs" for="compressImagesBeforeUploading">
              Compress images before uploading
            </label>
          </div>
          <div v-if="compressImagesBeforeUploading" class="text-xs pt-4 pl-2">
            <div>
              <label for="removeEXIF" class="flex items-center"><input id="removeEXIF" type="checkbox"
                  v-model="defaultCompressOptions.removeEXIF"> Remove EXIF</label>
            </div>
            <div class="flex">
              <label for="covertImageType" class="flex items-center">
                <input id="covertImageType" type="checkbox" class="shrink-0"
                  v-model="defaultCompressOptions.convertImageType">
                <span class="shrink-0">Covert to</span>
                <select :disabled="!defaultCompressOptions.convertImageType"
                  class="shrink-0 mb-0 ml-2 text-sm py-1 px-2" v-model="defaultCompressOptions.imageType">
                  <option value="jpeg">jpg</option>
                  <option value="png">png</option>
                  <option value="webp">webp</option>
                </select>
              </label>
            </div>
            <div class="flex">
              <label for="maxWidth" class="flex items-center">
                <span class="shrink-0">Max Width:</span>
                <input type="number" class="text-xs py-1 px-2 ml-1 mb-0"
                  style="margin-bottom: 0; padding: .25rem .25rem; height: auto"
                  v-model="defaultCompressOptions.maxWidth" id="maxWidth" placeholder="Infinity">
              </label>
            </div>
            <div class="flex">
              <label for="maxHeight" class="flex items-center">
                <span class="shrink-0">Max Height:</span>
                <input type="number" class="text-xs py-1 px-2 ml-1 mb-0"
                  style="margin-bottom: 0; padding: .25rem .25rem; height: auto"
                  v-model="defaultCompressOptions.maxHeight" id="maxHeight" placeholder="Infinity">
              </label>
            </div>
            <div class="flex">
              <label for="quality" class="flex items-center">
                <span class="shrink-0">Image Quality:</span>
                <input type="number" class="text-xs py-1 px-2 ml-1 mb-0"
                  style="margin-bottom: 0; padding: .25rem .25rem; height: auto"
                  v-model="defaultCompressOptions.quality" id="quality">
              </label>
            </div>
          </div>
        </div>

        <div class="pt-4 pb-2 text-xs" v-show="fileList.length">
          Files Queued:
        </div>
        <div class="item rounded text-sm flex w-full mb-2 relative items-center" v-for="(item, index) in fileList"
          :key="item.key">
          <img class="max-h-14 mr-2" :src="item.url" @load="imgLoad(item.id_key, $event)" />
          <div class="w-full bg-neutral-50 text-xs rounded dark:bg-[#333] px-2 py-2 relative shadow">
            <div class="progress absolute h-[.1rem] bottom-0 left-0 transition-all" :style="{
                width: progressMap[item.key] + '%'
              }" :class="[
              statusMap[item.key] === 'error' ? 'bg-red-500' :
              statusMap[item.key] === 'dup' ? 'bg-amber-500' :
              'bg-green-400 dark:bg-green-600'
              ]"></div>
            <div v-show="editKey === item.key" class="flex">
              <form action="javascript:" @submit="renameThisFile(item)" class="flex mb-0 w-full">
                <input class="text-xs w-full" type="text" style="padding: 0.2rem 0.4rem; margin: 0; height: auto"
                  :value="renameFileWithRandomId ? item.id_key : item.key" :id="'input_' + item.key" />
                <button class="ml-2 inline-block w-auto shrink-0 outline text-xs text-emerald-500 mb-0"
                  style="padding: 0; border: none; background: transparent" type="submit">Rename
                </button>
                <button type="button" @click="editKey = null"
                  class="inline-block mb-0 w-auto shrink-0 outline ml-2 dark:text-white text-black text-xs"
                  style="padding: 0; border: 0">Cancel
                </button>
              </form>
            </div>
            <span :data-tooltip="statusMap[item.key] === 'uploading' ? 'Can\'t rename now' : 'Click to rename'" v-show="editKey !== item.key"
              class="inline-block break-all" @click="showRenameInput(item.key, statusMap[item.key])">{{ renameFileWithRandomId ? item.id_key
              : item.key }}</span><br /><span :style="{
                marginTop: editKey === item.key ? '0' : '0.25rem',
                top: editKey !== item.key ? 0 : '-.2rem'
              }" class="opacity-80 mt-1 inline-block relative font-mono" :class="[
              statusMap[item.key] === 'error' ? 'text-red-500' :
              statusMap[item.key] === 'dup' ? 'text-amber-500' :
              'text-green-400 dark:text-green-600'
              ]">{{ parseByteSize(item.size) }}
              <span v-show="uploading && !item.compressing"> / {{ progressMap[item.key] }}%</span>
              <span v-show="item.compressing">Compressing...</span></span>
          </div>
          <div v-show="editKey !== item.key" class="rounded text0-xs px-2 cursor-pointer hover:text-red-500"
            @click="removeThisFile(index, item.key)">
            <i class="iconfont icon-error"></i>
          </div>
          <div title="Re-Upload this file" v-show="statusMap[item.key] !== 'uploading'"
            class="rounded text0-xs px-2 cursor-pointer" @click="reUploadThisFile(index, item.key)">
            <i class="iconfont icon-reload"></i>
          </div>
        </div>

        <div class="pt-4 pb-2 text-xs" v-show="uploadedList.length">
          Uploaded List:
        </div>
        <div class="item rounded text-sm flex w-full mb-2 relative items-center" v-for="(item, index) in uploadedList"
          :key="item.key">
          <img class="max-h-14 mr-2" :src="item.url" />
          <div class="w-full bg-neutral-50 text-xs rounded dark:bg-[#333] px-2 py-2 relative shadow">
            <div class="progress absolute h-[.1rem] bottom-0 left-0 transition-all" :style="{
                width: progressMap[item.key] + '%'
              }" :class="[
              statusMap[item.key] === 'error' ? 'bg-red-500' :
              statusMap[item.key] === 'dup' ? 'bg-amber-500' :
              'bg-green-400 dark:bg-green-600'
              ]"></div>
            <div v-show="editKey === item.key" class="flex">
              <form action="javascript:" @submit="renameThisFile(item)" class="flex mb-0 w-full">
                <input class="text-xs w-full" type="text" style="padding: 0.2rem 0.4rem; margin: 0; height: auto"
                  :value="renameFileWithRandomId ? item.id_key : item.key" :id="'input_' + item.key" />
                <button class="ml-2 inline-block w-auto shrink-0 outline text-xs text-emerald-500 mb-0"
                  style="padding: 0; border: none; background: transparent" type="submit">Rename
                </button>
                <button type="button" @click="editKey = null"
                  class="inline-block mb-0 w-auto shrink-0 outline ml-2 dark:text-white text-black text-xs"
                  style="padding: 0; border: 0">Cancel
                </button>
              </form>
            </div>
            <span :data-tooltip="uploading ? 'Can\'t rename now' : 'Click to rename'" v-show="editKey !== item.key"
              class="inline-block break-all" @click="showRenameInput(item.key, statusMap[item.key])">{{ renameFileWithRandomId ? item.id_key
              : item.key }}</span><br /><span :style="{
                marginTop: editKey === item.key ? '0' : '0.25rem',
                top: editKey !== item.key ? 0 : '-.2rem'
              }" class="opacity-80 mt-1 inline-block relative font-mono" :class="[
              statusMap[item.key] === 'error' ? 'text-red-500' :
              statusMap[item.key] === 'dup' ? 'text-amber-500' :
              'text-green-400 dark:text-green-600'
              ]">{{ parseByteSize(item.size) }} <a
                :href="customDomain + (renameFileWithRandomId ? item.id_key : item.key) + dimensionMap[item.url]">dimension
              </a>
              <a :href="endPoint + (renameFileWithRandomId ? item.id_key : item.key)" target="_blank">preview</a>
              <span v-show="uploading && !item.compressing"> / {{ progressMap[item.key] }}%</span>
              <span v-show="item.compressing">Compressing...</span></span>
          </div>
          <div v-show="editKey !== item.key" class="rounded text0-xs px-2 cursor-pointer hover:text-red-500"
            @click="removeThisFile(index, item.key)">
            <i class="iconfont icon-error"></i>
          </div>
          <div title="Re-Upload this file" v-show="statusMap[item.key] !== 'uploading'"
            class="rounded text0-xs px-2 cursor-pointer" @click="reUploadThisFile(index, item.key)">
            <i class="iconfont icon-reload"></i>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup>
import {reactive, ref, watch, onMounted} from 'vue'
import axios from 'axios'
import {useStatusStore} from '../store/status'
import {nanoid} from 'nanoid'
import Compressor from 'compressorjs'
import {storeToRefs} from 'pinia'

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
let skipFilesWithTheSameName = ref(false)
let uploadIsDone = ref(false)

let realTimeSpeedRecords = ref({})

let editKey = ref('')
let urlSuffix = ''
let renameFileWithRandomId = ref(false)
let compressImagesBeforeUploading = ref(false)
let endPoint = localStorage.getItem('endPoint')
let customDomain = localStorage.getItem('customDomain') ?? endPoint
let {endPointUpdated} = storeToRefs(statusStore)

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

let updateConflictBehave = function (e) {
  urlSuffix = e.target.value ? `?${e.target.value}` : ''
}

watch(endPointUpdated, (newVal) => {
  endPoint = localStorage.getItem('endPoint')
  customDomain = localStorage.getItem('customDomain') ?? endPoint
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

watch(skipFilesWithTheSameName, (val) => {
  if (val) {
    updateFileSkipProperty()
  } else {
    fileList.value.forEach((file) => {
      file.shouldBeSkipped = false
    })
  }
})

watch(renameFileWithRandomId, () => {
  updateFileSkipProperty()
})

let updateFileSkipProperty = function () {
  let uploadedFiles = statusStore.uploadedFiles

  fileList.value.forEach((file) => {
    let diff_key = renameFileWithRandomId.value ? 'id_key' : 'key'
    let match = uploadedFiles.findIndex((el) => el[diff_key] === formatFileName(file[diff_key]))
    file.shouldBeSkipped = match !== -1
  })
}

let reUploadThisFile = function (index, key) {
  let file = fileList.value.find((el) => key === el.key)
  uploadFile(file)
}

let renameThisFile = function (file) {
  let input = document.getElementById('input_' + file.key)

  if (renameFileWithRandomId.value) {
    if (input.value === file.id_key) {
      editKey.value = ''
      return false
    }

    let match = fileList.value.findIndex((el) => el.id_key === input.value)

    if (match !== -1) {
      alert('File with the same name already exists.')
      return false
    }

    file.id_key = input.value
    editKey.value = ''
  } else {
    if (input.value === file.key) {
      editKey.value = ''
      return false
    }

    let match = fileList.value.findIndex((el) => el.key === input.value)

    if (match !== -1) {
      alert('File with the same name already exists.')
      return false
    }

    file.key = input.value
    editKey.value = ''
  }
}

let showRenameInput = function (key, status) {
  if (status == 'uploading') {
    return false
  }
  editKey.value = key
}

let genImagePreview  = function (ext, file) {
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

let formatFileName = function (name) {
  // replace all the spaces with '_'
  return name.replace(/\s/g, '_')
}

let generateUri = function (file) {
  const endPoint = localStorage.getItem('endPoint')
  const apiKey = localStorage.getItem('apiKey')
  let url = null
  let err = false

  if (!endPoint || !apiKey) {
    err = true
    alert('Please set an endpoint and api key first.')
  } else {
    let file_key = renameFileWithRandomId.value ? file.id_key : file.key
    url = endPoint + formatFileName(file_key)
  }
  return {
    url: url,
    apiKey: apiKey,
    err: err
  }
}

let handleFilesChange = function (e) {
  uploadedList.value = []
  progressMap.value = {}
  statusMap.value = {}
  abortControllerMap.value = {}

  Array.from(e.target.files).forEach((file) => {
    file.key = file.name
    // get extension
    let extension = file.name.split('.').pop()
    file.id_key = nanoid(16) + '.' + extension
    genImagePreview(extension, file)
  })

  fileList.value = [...fileList.value, ...Array.from(e.target.files)]

  // remove duplicate files

  let fileNames = fileList.value.map((item) => item.key)
  fileList.value = fileList.value.filter((item, index) => {
    return fileNames.indexOf(item.key) === index
  })
}

let imgLoad = function(key, e) {
  let file = fileList.value.find((el) => key === el.id_key)
  if (file) dimensionMap.value[file.url] = `?size=${e.target.naturalWidth}x${e.target.naturalHeight}`
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
    skipFilesWithTheSameName.value = false

    document.getElementById('fileInput').value = ''
  }
}

let removeThisFile = function (index, name) {
  if (statusMap.value[name] == 'uploading') {
    let c = confirm(`Uploading is in progress, are you sure to remove ${name}?`)

    if (!c) {
      return false
    }

    abortControllerMap.value[name].abort()
    fileList.value.splice(index, 1)

    doneUploadingCleanUp()

    return false
  } else if (statusMap.value[name] == 'done') {
    const {url, apiKey, err} = generateUri(uploadedList.value[index])
    let c = confirm(`Are you sure to remove ${name} from remote?`)
    if (!c || err) {
      return false
    }
    statusMap.value[name] == 'deleting'
    axios({
      method: 'delete',
      headers: {
        'x-api-key': apiKey
      },
      url: url
    })
    .then(() => {
      uploadedList.value.splice(index, 1)
    })
    .catch(() => {
      statusMap.value[name] == 'done'
      alert('Failed to delete file.')
    })
} else {
  let c = confirm(`are you sure to remove ${name}?`)
  if (!c) {
    return false
  }
  fileList.value.splice(index, 1)
}
}

const uploadedList = ref([])
const upload = function () {
  uploading.value = true
  statusStore.uploading = true
  realTimeSpeedRecords.value = {}
  uploadIsDone.value = false

  fileList.value.forEach(async (file, index) => {
    if (file.shouldBeSkipped) {
      statusMap.value[file.key] = 'done'
      fileList.value = fileList.value.filter((item) => item.key !== file.key)

      doneUploadingCleanUp()

      return false
    }

    if (compressImagesBeforeUploading.value) {
      file['compressing'] = true
      fileList.value[index] = await compressImage(file)
      file['compressing'] = false

      uploadFile(fileList.value[index])
      return false
    }

    uploadFile(file)
  })
}

function handlePaste() {
  window.addEventListener('paste', (e) => {
    // Check if any input or textarea is focused
    const activeElement = document.activeElement;
    const isInputFocused = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';
    
    if (isInputFocused) {
      return; // Do nothing if an input/textarea is focused
    }
    let files = e.clipboardData.files
    if (files.length === 0) return; // Do nothing if no files were pasted

    renameFileWithRandomId.value = true
    compressImagesBeforeUploading.value = true
    Array.from(files).forEach((file) => {
      file.key = file.name
      // get extension
      let extension = file.name.split('.').pop()
      file.id_key = nanoid(16) + '.' + extension
      genImagePreview(extension, file)
    })

    fileList.value = [...fileList.value, ...Array.from(files)]
  })
}

function uploadFile(file) {
  const {url, apiKey, err} = generateUri(file)
  if (err) return false
  if (file['compressing'] !== undefined) {
    file.compressing = false
  }
  progressMap.value[file.key] = 0
  abortControllerMap.value[file.key] = new AbortController()
  statusMap.value[file.key] = 'uploading'

  file.startUploadingTime = new Date().getTime()

  realTimeSpeedRecords.value[file.key] = [
    {
      time: new Date().getTime(),
      loaded: 0
    }
  ]

  axios({
    method: 'put',
    url: url + urlSuffix,
    headers: {
      'x-api-key': apiKey,
      'content-type': file.type
    },
    signal: abortControllerMap.value[file.key].signal,
    data: file,
    onUploadProgress(event) {
      progressMap.value[file.key] = ((100 * event.loaded) / event.total).toFixed(1)

      realTimeSpeedRecords.value[file.key].push({
        time: new Date().getTime(),
        loaded: event.loaded
      })
    }
  })
    .then((res) => {
      statusMap.value[file.key] = 'done'
      const key = decodeURIComponent(res.headers['content-location'])
      if (key && key != file.key) file.key = key
      file.endUploadingTime = new Date().getTime()
      file.uploadUsedTime = file.endUploadingTime - file.startUploadingTime
      file.uploadSpeed = calcUploadSpeed(file.size, file.uploadUsedTime)
      uploadedList.value.push(file)
      fileList.value = fileList.value.filter((item) => item.key !== file.key)
    })
    .catch((e) => {
      if (e.response && e.response.status == 409) statusMap.value[file.key] = 'dup'
      else statusMap.value[file.key] = 'error'
    })
    .finally(() => {
      doneUploadingCleanUp()
    })
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

handlePaste()
</script>
