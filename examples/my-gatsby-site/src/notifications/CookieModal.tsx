import {connectNotification} from '@jaenjs/jaen'

const CookieModal = () => {
  return (
    <div className="cookie-modal">
      <div className="cookie-modal__content">
        <div className="cookie-modal__content__text">
          <p>
            This website uses cookies to ensure you get the best experience on
            our website.
          </p>
          <p>By continuing to use this site you agree to our use of cookies.</p>
        </div>
        <div className="cookie-modal__content__buttons">
          <button className="cookie-modal__content__buttons__button">
            Accept
          </button>
          <button className="cookie-modal__content__buttons__button">
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}

export default connectNotification(CookieModal, {
  position: 'modal-center',
  conditions: {
    entireSite: true
  },
  triggers: {
    onPageScroll: {
      percentage: 0.5,
      direction: 'down'
    }
  }
})
