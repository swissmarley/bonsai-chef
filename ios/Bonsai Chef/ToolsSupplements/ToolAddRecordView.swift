//
//  ToolAddRecordView.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 17.06.2024.
//
import SwiftUI
import PhotosUI

struct ToolAddRecordView: View {
    @ObservedObject var toolsSupplementsData: ToolsSupplementsData
    @State private var toolName = ""
    @State private var type: ToolSupplementType = .tool
    @State private var toolData1 = ""
    @State private var toolData2 = ""
    @State private var toolData3 = ""
    @State private var toolData4 = ""
    @State private var toolDetails = ""
    @State private var selectedPhotos: [UIImage] = []
    @State private var showImagePicker = false
    @State private var selectedCategories: [ToolCategory] = [.all, .category3] // Default categories
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("Nome", text: $toolName)
                    Picker("Tipologia", selection: $type) {
                        ForEach(ToolSupplementType.allCases, id: \.self) { type in
                            Text(type.rawValue)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                TextField("Genere", text: $toolData1)
                TextField("Venditore", text: $toolData2)
                TextField("Prezzo", text: $toolData3)
                Section(header: Text("Links")) {
                    TextEditor(text: $toolData4)
                }
                Section(header: Text("Dettagli")) {
                    TextEditor(text: $toolDetails)
                }
                Section(header: Text("Fotos")) {
                    HStack {
                        Text("Fotos:")
                        Spacer()
                        Button("Aggiungi Foto") {
                            showImagePicker = true
                        }
                        .sheet(isPresented: $showImagePicker) {
                            ImagePicker(selectedImages: $selectedPhotos)
                        }
                    }
                    ForEach(selectedPhotos.indices, id: \.self) { index in
                        Image(uiImage: selectedPhotos[index])
                            .resizable()
                            .scaledToFit()
                            .frame(height: 100)
                            .onTapGesture {
                                selectedPhotos.remove(at: index)
                            }
                    }
                }
                
                Section {
                    Button("Salva") {
                        saveRecord()
                    }
                }
            }
            .navigationTitle("Aggiungi Strumento")
            .navigationBarItems(trailing: Button("Annulla") {
                presentationMode.wrappedValue.dismiss()
            })
        }
    }
    
    func saveRecord() {
        let photoPaths = selectedPhotos.compactMap { saveImageToDocumentDirectory($0) }
        let newRecord = ToolsSupplementsRecord(toolName: toolName, type: type, toolData1: toolData1, toolData2: toolData2, toolData3: toolData3, toolData4: toolData4, toolDetails: toolDetails, toolPhotoPaths: photoPaths)
        toolsSupplementsData.records.append(newRecord)
        toolsSupplementsData.saveRecords()
        presentationMode.wrappedValue.dismiss()
    }
    
    private func saveImageToDocumentDirectory(_ image: UIImage) -> String? {
        guard let data = image.jpegData(compressionQuality: 0.8) else { return nil }
        let fileName = UUID().uuidString + ".jpeg"
        let fileURL = getDocumentsDirectory().appendingPathComponent(fileName)
        do {
            try data.write(to: fileURL)
            return fileName
        } catch {
            print("Error saving image: \(error.localizedDescription)")
            return nil
        }
    }
    
    private func getDocumentsDirectory() -> URL {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    }
}

