import {RootState, store} from '.'

export const persistKey = 'jaen-pages-state'

export const loadState = (): RootState | undefined => {
  try {
    const serialState = localStorage.getItem(persistKey)
    alert('load state: ' + serialState)
    if (serialState === null) {
      return undefined
    }
    return JSON.parse(serialState) as RootState
  } catch (err) {
    return undefined
  }
}

export const saveState = (state: RootState) => {
  alert('save: ' + JSON.stringify(state))
  try {
    const serialState = JSON.stringify(state)
    localStorage.setItem(persistKey, serialState)
  } catch (err) {
    console.log(err)
  }
}

export const clearState = () => {
  alert('clear')
  localStorage.removeItem(persistKey)
  store.dispatch({type: 'RESET_STATE'})
  alert('cleared')
}
