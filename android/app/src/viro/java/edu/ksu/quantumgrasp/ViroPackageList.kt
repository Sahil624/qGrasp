package edu.ksu.quantumgrasp

import com.facebook.react.ReactPackage
import com.viromedia.bridge.ReactViroPackage

object ViroPackageList {
  fun packages(): List<ReactPackage> = listOf(
    ReactViroPackage(ReactViroPackage.ViroPlatform.AR),
    ReactViroPackage(ReactViroPackage.ViroPlatform.GVR),
  )
}
