import { useCall } from '../../context/CallContext'
import IncomingCallPopup from './IncomingCallPopup'
import CallWindow from './CallWindow'

export default function CallOverlay() {
  const { activeCall, incomingCall } = useCall()

  return (
    <>
      {incomingCall && !activeCall && <IncomingCallPopup />}
      {activeCall && <CallWindow />}
    </>
  )
}
