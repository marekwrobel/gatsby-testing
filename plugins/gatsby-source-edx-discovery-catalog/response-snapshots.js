/* eslint-disable no-param-reassign, consistent-return */
const fs = require('fs-jetpack');
const getHashSum = require('@danielkalen/hash-sum');

const SNAPSHOTS_DIRECTORY = './.datasnapshots-disco';
const HEADERS_GETTER = (field) => this[field];
const state = {
  directoryCreated: false,
  directoryContentsLoaded: false,
  directoryContents: {},
};

const loadDirectoryContents = async () => {
  if (state.directoryContentsLoaded) {
    return;
  }
  const list = await fs.listAsync(SNAPSHOTS_DIRECTORY);

  list.forEach((entry) => {
    state.directoryContents[entry] = true;
  });

  state.directoryContentsLoaded = true;
};

const createSnapshotDirectory = () => {
  if (state.directoryCreated) {
    return;
  }

  state.directoryCreated = true;
  return fs.dirAsync(SNAPSHOTS_DIRECTORY);
};

const doesSnapshotExist = (hashSum) => (
  !!state.directoryContents[hashSum]
);

const saveResponse = async (response, url) => {
  if (!process.env.USE_SNAPSHOTTED_DATA) {
    return;
  }

  const hashSum = getHashSum(url);
  const snapshotPath = `${SNAPSHOTS_DIRECTORY}/${hashSum}`;
  await createSnapshotDirectory();
  return fs.writeAsync(snapshotPath, response);
};

const attemptFetch = async (url) => {
  if (!process.env.USE_SNAPSHOTTED_DATA) {
    return [false, null];
  }
  await loadDirectoryContents();
  const hashSum = getHashSum(url);
  const snapshotPath = `${SNAPSHOTS_DIRECTORY}/${hashSum}`;
  const exists = doesSnapshotExist(hashSum);
  let snapshottedResponse = null;

  if (exists) {
    snapshottedResponse = await fs.readAsync(snapshotPath, 'json');
    snapshottedResponse.headers.get = HEADERS_GETTER;
  }

  return [exists, snapshottedResponse];
};

module.exports = { createSnapshotDirectory, saveResponse, attemptFetch };
